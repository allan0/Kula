// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// =============================================================================
// FILE: contracts/KulaGovernance.sol
// PURPOSE: On-chain governance for the Kula protocol. Manages proposals for
//          treasury payouts and asset purchases. The KulaGovernance contract
//          address is the sole holder of TREASURY_ROLE in RotaryGroup, making
//          it the only contract that can trigger executePayout().
// SECURITY: ReentrancyGuard on executePayout.
//           AccessControl — TREASURY_ROLE granted to this contract itself
//           so internal execution is self-authorised via the RotaryGroup call.
//           Proposal state is finalised before any external call (CEI).
// =============================================================================

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IKulaInterfaces.sol";

contract KulaGovernance is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // ROLES
    // -------------------------------------------------------------------------

    /// @notice Accounts with this role can create governance proposals.
    ///         In production, grant this to group treasurers after verification.
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    /// @notice Admin role for initial contract wiring (deployer only).
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // EXTERNAL CONTRACT REFERENCES
    // -------------------------------------------------------------------------

    /// @notice The RotaryGroup contract — executePayout() is called on it.
    ///         KulaGovernance must hold TREASURY_ROLE in RotaryGroup.
    address public rotaryGroup;

    /// @notice USDC token — used for direct bill/medical payout proposals
    ///         that transfer funds to an external recipient (not via RotaryGroup).
    IERC20 public immutable usdc;

    // -------------------------------------------------------------------------
    // CONSTANTS
    // -------------------------------------------------------------------------

    /// @notice Proposal passes when votesFor exceeds this percentage of
    ///         total eligible voters (basis points — 5000 = 50%).
    uint256 public constant APPROVAL_THRESHOLD_BPS = 5000;
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Voting window — proposals expire after 72 hours
    uint256 public constant VOTING_WINDOW = 72 hours;

    // -------------------------------------------------------------------------
    // DATA STRUCTURES
    // -------------------------------------------------------------------------

    /// @notice The type of governance action a proposal triggers.
    enum ProposalType {
        ROSCA_PAYOUT,       // Trigger RotaryGroup.executePayout() for a group cycle
        ASSET_PURCHASE,     // Transfer treasury funds for a verified RWA purchase
        DIRECT_BILL         // Direct USDC transfer to a recipient (medical, emergency)
    }

    /// @notice Full proposal state
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        string description;
        string documentHash;        // IPFS CID of supporting documents (deed, invoice)
        uint256 amount;             // USDC amount (6 decimals) — 0 for ROSCA_PAYOUT
        address recipient;          // Funds destination for ASSET_PURCHASE / DIRECT_BILL
        uint256 groupId;            // Associated RotaryGroup group ID
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 totalEligibleVoters;
        uint256 createdAt;          // Block timestamp at creation
        uint256 deadline;           // createdAt + VOTING_WINDOW
        bool executed;
        bool cancelled;
    }

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    /// @notice Proposal store — proposalId => Proposal
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    /// @notice Tracks whether an address has voted on a given proposal
    /// proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Tracks individual vote direction for audit purposes
    /// proposalId => voter => votedFor (true = for, false = against)
    mapping(uint256 => mapping(address => bool)) public voteRecord;

    /// @notice Eligible voters per group — set when a proposal is created.
    ///         Snapshotted at proposal creation to prevent vote manipulation.
    /// proposalId => voter => isEligible
    mapping(uint256 => mapping(address => bool)) public eligibleVoters;

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    event ProposalCreated(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        uint256 indexed groupId,
        address proposer,
        uint256 amount,
        uint256 deadline
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 currentVotesFor,
        uint256 currentVotesAgainst
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        ProposalType indexed proposalType,
        address indexed recipient,
        uint256 amount
    );
    event ProposalCancelled(uint256 indexed proposalId, address cancelledBy);
    event RotaryGroupSet(address indexed rotaryGroupAddress);

    // -------------------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------------------

    error ProposalNotFound(uint256 proposalId);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalAlreadyCancelled(uint256 proposalId);
    error ProposalExpired(uint256 proposalId, uint256 deadline);
    error ProposalNotYetExpired(uint256 proposalId, uint256 deadline);
    error AlreadyVoted(uint256 proposalId, address voter);
    error NotEligibleVoter(uint256 proposalId, address voter);
    error ThresholdNotMet(uint256 proposalId, uint256 votesFor, uint256 required);
    error RotaryGroupNotSet();
    error DirectTransferFailed(address recipient, uint256 amount);

    // -------------------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------------------

    /// @param _usdc  Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
    }

    // -------------------------------------------------------------------------
    // SETUP — called once after RotaryGroup is deployed
    // -------------------------------------------------------------------------

    /// @notice Wires the RotaryGroup address into this contract.
    ///         Must be called by admin after both contracts are deployed.
    ///         KulaGovernance must already hold TREASURY_ROLE in RotaryGroup
    ///         (this is set in RotaryGroup's constructor automatically).
    function setRotaryGroup(address _rotaryGroup) external onlyRole(ADMIN_ROLE) {
        require(_rotaryGroup != address(0), "Invalid RotaryGroup address");
        rotaryGroup = _rotaryGroup;
        emit RotaryGroupSet(_rotaryGroup);
    }

    /// @notice Grants PROPOSER_ROLE to a group treasurer.
    ///         Called by admin after group creation and member verification.
    function grantProposerRole(address _treasurer) external onlyRole(ADMIN_ROLE) {
        _grantRole(PROPOSER_ROLE, _treasurer);
    }

    // -------------------------------------------------------------------------
    // PROPOSAL CREATION
    // -------------------------------------------------------------------------

    /// @notice Creates a ROSCA_PAYOUT proposal — when executed, triggers
    ///         RotaryGroup.executePayout() for the specified group.
    ///         No USDC amount is needed; the payout amount is the group's
    ///         full current balance at execution time.
    /// @param _groupId      RotaryGroup group ID
    /// @param _description  Human-readable description
    /// @param _documentHash IPFS CID of any supporting documents
    /// @param _memberSnapshot  Snapshot of eligible voter addresses at creation time
    function createRoscaPayoutProposal(
        uint256 _groupId,
        string calldata _description,
        string calldata _documentHash,
        address[] calldata _memberSnapshot
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        proposalId = _createProposal(
            ProposalType.ROSCA_PAYOUT,
            _description,
            _documentHash,
            0,
            address(0),
            _groupId,
            _memberSnapshot
        );
    }

    /// @notice Creates an ASSET_PURCHASE proposal — when executed, transfers
    ///         _amount USDC from this contract to _recipient for a verified RWA.
    /// @param _groupId      Associated group
    /// @param _description  Description of the asset being purchased
    /// @param _documentHash IPFS CID of the deed or logbook
    /// @param _amount       USDC amount (6 decimals)
    /// @param _recipient    Seller or escrow address receiving payment
    /// @param _memberSnapshot  Snapshot of eligible voter addresses
    function createAssetPurchaseProposal(
        uint256 _groupId,
        string calldata _description,
        string calldata _documentHash,
        uint256 _amount,
        address _recipient,
        address[] calldata _memberSnapshot
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        require(_amount > 0, "Amount must be > 0");
        require(_recipient != address(0), "Invalid recipient");

        proposalId = _createProposal(
            ProposalType.ASSET_PURCHASE,
            _description,
            _documentHash,
            _amount,
            _recipient,
            _groupId,
            _memberSnapshot
        );
    }

    /// @notice Creates a DIRECT_BILL proposal — medical, emergency, or
    ///         operational expense. Transfers USDC directly to a recipient.
    /// @param _groupId      Associated group
    /// @param _description  Nature of the bill (e.g. "Medical Support - Member #08")
    /// @param _documentHash IPFS CID of invoice or medical document
    /// @param _amount       USDC amount (6 decimals)
    /// @param _recipient    Address receiving the bill payment
    /// @param _memberSnapshot  Snapshot of eligible voter addresses
    function createDirectBillProposal(
        uint256 _groupId,
        string calldata _description,
        string calldata _documentHash,
        uint256 _amount,
        address _recipient,
        address[] calldata _memberSnapshot
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 proposalId) {
        require(_amount > 0, "Amount must be > 0");
        require(_recipient != address(0), "Invalid recipient");

        proposalId = _createProposal(
            ProposalType.DIRECT_BILL,
            _description,
            _documentHash,
            _amount,
            _recipient,
            _groupId,
            _memberSnapshot
        );
    }

    // -------------------------------------------------------------------------
    // VOTING
    // -------------------------------------------------------------------------

    /// @notice Cast a vote on an active proposal.
    ///         Voter must be in the eligibleVoters snapshot taken at creation.
    ///         Voting closes at proposal.deadline (createdAt + 72 hours).
    /// @param _proposalId  Target proposal
    /// @param _support     true = vote for, false = vote against
    function castVote(uint256 _proposalId, bool _support) external {
        Proposal storage p = _getActiveProposal(_proposalId);

        if (!eligibleVoters[_proposalId][msg.sender]) {
            revert NotEligibleVoter(_proposalId, msg.sender);
        }
        if (hasVoted[_proposalId][msg.sender]) {
            revert AlreadyVoted(_proposalId, msg.sender);
        }
        if (block.timestamp > p.deadline) {
            revert ProposalExpired(_proposalId, p.deadline);
        }

        hasVoted[_proposalId][msg.sender] = true;
        voteRecord[_proposalId][msg.sender] = _support;

        if (_support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit VoteCast(_proposalId, msg.sender, _support, p.votesFor, p.votesAgainst);
    }

    // -------------------------------------------------------------------------
    // EXECUTION
    // -------------------------------------------------------------------------

    /// @notice Executes an approved proposal after the voting window closes.
    ///         Checks: not executed, not cancelled, deadline passed,
    ///         approval threshold met (>50% of eligible voters).
    ///
    ///         Execution paths:
    ///         - ROSCA_PAYOUT:     calls RotaryGroup.executePayout(groupId)
    ///         - ASSET_PURCHASE:   safeTransfer USDC to recipient
    ///         - DIRECT_BILL:      safeTransfer USDC to recipient
    ///
    /// @param _proposalId  Proposal to execute
    function executePayout(uint256 _proposalId) external nonReentrant {
        Proposal storage p = proposals[_proposalId];

        if (p.createdAt == 0) revert ProposalNotFound(_proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(_proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(_proposalId);

        // Voting window must have closed before execution
        if (block.timestamp <= p.deadline) {
            revert ProposalNotYetExpired(_proposalId, p.deadline);
        }

        // Check approval threshold: votesFor must be > 50% of eligible voters
        uint256 required = (p.totalEligibleVoters * APPROVAL_THRESHOLD_BPS) / BPS_DENOMINATOR;
        if (p.votesFor <= required) {
            revert ThresholdNotMet(_proposalId, p.votesFor, required);
        }

        // --- CEI: Mark executed BEFORE any external calls ---
        p.executed = true;

        if (p.proposalType == ProposalType.ROSCA_PAYOUT) {
            if (rotaryGroup == address(0)) revert RotaryGroupNotSet();

            // KulaGovernance holds TREASURY_ROLE in RotaryGroup —
            // this call is authorised by AccessControl in RotaryGroup
            (bool success, bytes memory data) = rotaryGroup.call(
                abi.encodeWithSignature("executePayout(uint256)", p.groupId)
            );
            require(success, _getRevertMsg(data));

            emit ProposalExecuted(_proposalId, ProposalType.ROSCA_PAYOUT, address(0), 0);

        } else if (p.proposalType == ProposalType.ASSET_PURCHASE) {
            usdc.safeTransfer(p.recipient, p.amount);
            emit ProposalExecuted(_proposalId, ProposalType.ASSET_PURCHASE, p.recipient, p.amount);

        } else if (p.proposalType == ProposalType.DIRECT_BILL) {
            usdc.safeTransfer(p.recipient, p.amount);
            emit ProposalExecuted(_proposalId, ProposalType.DIRECT_BILL, p.recipient, p.amount);
        }
    }

    // -------------------------------------------------------------------------
    // CANCELLATION
    // -------------------------------------------------------------------------

    /// @notice Cancels a proposal before it is executed.
    ///         Only callable by an ADMIN or the original PROPOSER while
    ///         the voting window is still open.
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        if (p.createdAt == 0) revert ProposalNotFound(_proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(_proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(_proposalId);

        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(PROPOSER_ROLE, msg.sender),
            "Not authorised to cancel"
        );

        p.cancelled = true;
        emit ProposalCancelled(_proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // VIEWS
    // -------------------------------------------------------------------------

    /// @notice Returns whether a proposal has met its approval threshold.
    ///         Used by the frontend to show "Ready to Execute" state.
    function isApproved(uint256 _proposalId) external view returns (bool) {
        Proposal storage p = proposals[_proposalId];
        if (p.createdAt == 0 || p.executed || p.cancelled) return false;
        uint256 required = (p.totalEligibleVoters * APPROVAL_THRESHOLD_BPS) / BPS_DENOMINATOR;
        return p.votesFor > required;
    }

    /// @notice Returns full proposal details
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_proposalId];
    }

    /// @notice Returns vote counts and status for a proposal
    function getVoteStatus(uint256 _proposalId) external view returns (
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 totalEligible,
        bool approved,
        bool expired
    ) {
        Proposal storage p = proposals[_proposalId];
        votesFor = p.votesFor;
        votesAgainst = p.votesAgainst;
        totalEligible = p.totalEligibleVoters;
        uint256 required = (totalEligible * APPROVAL_THRESHOLD_BPS) / BPS_DENOMINATOR;
        approved = votesFor > required;
        expired = block.timestamp > p.deadline;
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS
    // -------------------------------------------------------------------------

    /// @dev Shared proposal creation logic. Snapshots eligible voters at
    ///      creation time to prevent post-creation manipulation.
    function _createProposal(
        ProposalType _type,
        string calldata _description,
        string calldata _documentHash,
        uint256 _amount,
        address _recipient,
        uint256 _groupId,
        address[] calldata _memberSnapshot
    ) internal returns (uint256 proposalId) {
        require(_memberSnapshot.length > 0, "Must provide at least one eligible voter");

        proposalCount++;
        proposalId = proposalCount;

        uint256 deadline = block.timestamp + VOTING_WINDOW;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposalType: _type,
            description: _description,
            documentHash: _documentHash,
            amount: _amount,
            recipient: _recipient,
            groupId: _groupId,
            votesFor: 0,
            votesAgainst: 0,
            totalEligibleVoters: _memberSnapshot.length,
            createdAt: block.timestamp,
            deadline: deadline,
            executed: false,
            cancelled: false
        });

        // Snapshot eligible voters
        for (uint256 i = 0; i < _memberSnapshot.length; i++) {
            eligibleVoters[proposalId][_memberSnapshot[i]] = true;
        }

        emit ProposalCreated(
            proposalId,
            _type,
            _groupId,
            msg.sender,
            _amount,
            deadline
        );
    }

    /// @dev Returns the proposal and validates it is not already
    ///      executed or cancelled. Reverts with typed errors.
    function _getActiveProposal(uint256 _proposalId)
        internal
        view
        returns (Proposal storage p)
    {
        p = proposals[_proposalId];
        if (p.createdAt == 0) revert ProposalNotFound(_proposalId);
        if (p.executed) revert ProposalAlreadyExecuted(_proposalId);
        if (p.cancelled) revert ProposalAlreadyCancelled(_proposalId);
    }

    /// @dev Extracts revert reason from a failed low-level call's returndata.
    function _getRevertMsg(bytes memory _returnData)
        internal
        pure
        returns (string memory)
    {
        if (_returnData.length < 68) return "RotaryGroup call failed";
        assembly {
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }
}
