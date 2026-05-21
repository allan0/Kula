// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// =============================================================================
// FILE: contracts/RotaryGroup.sol
// PURPOSE: Core ROSCA (Rotating Savings & Credit Association) contract.
//          Manages group lifecycle, member contributions, reputation scoring,
//          and yield optimization via KulaYieldEngine.
// SECURITY: ReentrancyGuard on all fund-moving functions.
//           AccessControl for TREASURY_ROLE (held only by KulaGovernance).
//           proposeAsset() gates on IKulaPublicRegistry.isVerified().
// =============================================================================

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IKulaInterfaces.sol";

contract RotaryGroup is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // ROLES
    // -------------------------------------------------------------------------

    /// @notice Only the deployed KulaGovernance contract address holds this role.
    ///         It is the sole caller permitted to trigger executePayout().
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    /// @notice Assigned to the contract deployer. Used for admin setup only.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // EXTERNAL CONTRACT REFERENCES
    // -------------------------------------------------------------------------

    /// @notice USDC token contract (6 decimals on Base)
    IERC20 public immutable usdc;

    /// @notice KulaPublicRegistry — used to gate asset proposals
    IKulaPublicRegistry public immutable registry;

    /// @notice KulaYieldEngine — receives idle funds above liquidity buffer
    IKulaYieldEngine public immutable yieldEngine;

    // -------------------------------------------------------------------------
    // CONSTANTS
    // -------------------------------------------------------------------------

    /// @notice 20% of totalContributed must remain liquid at all times.
    ///         Funds above this threshold are sent to KulaYieldEngine.
    uint256 public constant LIQUIDITY_BUFFER_BPS = 2000; // 20% in basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Minimum votes required to admit a new member (absolute count)
    uint256 public constant ADMISSION_THRESHOLD = 3;

    // -------------------------------------------------------------------------
    // DATA STRUCTURES
    // -------------------------------------------------------------------------

    /// @notice Full group state stored on-chain
    struct Group {
        uint256 id;
        string name;
        address treasurer;          // The member who can trigger governance actions
        address[] members;
        uint256 contributionAmount; // USDC per cycle (6 decimals)
        uint256 intervalSeconds;    // Cycle length e.g. 604800 = 1 week
        uint256 totalContributed;   // Cumulative USDC deposited into this group
        uint256 currentBalance;     // Live USDC balance held by this contract
        uint256 currentRecipientIndex; // Index into members[] for current payout turn
        uint256 lastPayoutTimestamp;
        bool active;
    }

    /// @notice Per-member reputation — used for admission scoring and rewards
    struct MemberReputation {
        uint256 score;              // 0–100, initialised at 50
        uint256 consistentPayments;
        uint256 totalDelays;
        uint256 referralCount;
    }

    /// @notice Tracks a pending membership application for a group
    struct JoinRequest {
        address applicant;
        uint256 votesFor;
        uint256 votesAgainst;
        bool processed;
        mapping(address => bool) hasVoted;
    }

    /// @notice Tracks a pending asset proposal linked to a verified registry asset
    struct AssetProposal {
        uint256 groupId;
        uint256 registryAssetId;    // Must pass IKulaPublicRegistry.isVerified()
        address proposer;
        string description;
        uint256 requestedAmount;    // USDC amount requested from group treasury
        uint256 votesFor;
        bool executed;
        bool exists;
    }

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    /// @notice Primary group store — groupId => Group
    mapping(uint256 => Group) public groups;
    uint256 public groupCount;

    /// @notice Reputation store — address => MemberReputation
    mapping(address => MemberReputation) public reputations;

    /// @notice Join requests — groupId => applicant => JoinRequest
    mapping(uint256 => mapping(address => JoinRequest)) public joinRequests;

    /// @notice Asset proposals — proposalId => AssetProposal
    mapping(uint256 => AssetProposal) public assetProposals;
    uint256 public assetProposalCount;

    /// @notice Per-group, per-member contribution tracking for current cycle
    /// groupId => member => amount contributed this cycle
    mapping(uint256 => mapping(address => uint256)) public cycleContributions;

    /// @notice Tracks whether a member has voted on an asset proposal
    /// proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVotedOnProposal;

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    event GroupCreated(uint256 indexed groupId, string name, address indexed treasurer);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event ContributionReceived(uint256 indexed groupId, address indexed member, uint256 amount, uint256 timestamp);
    event PayoutExecuted(uint256 indexed groupId, address indexed recipient, uint256 amount);
    event LiquidityOptimized(uint256 indexed groupId, uint256 amountSent);
    event AssetProposed(uint256 indexed proposalId, uint256 indexed groupId, uint256 registryAssetId);
    event AssetProposalVoted(uint256 indexed proposalId, address indexed voter);
    event ReputationUpdated(address indexed member, uint256 newScore);
    event JoinRequestSubmitted(uint256 indexed groupId, address indexed applicant);
    event JoinRequestVoted(uint256 indexed groupId, address indexed applicant, address indexed voter, bool support);

    // -------------------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------------------

    error NotAMember(uint256 groupId, address caller);
    error GroupNotActive(uint256 groupId);
    error AssetNotVerified(uint256 assetId);
    error InsufficientGroupBalance(uint256 available, uint256 requested);
    error AlreadyAMember(uint256 groupId, address member);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error NotEnoughVotes(uint256 proposalId);
    error PayoutIntervalNotElapsed(uint256 groupId);
    error ZeroAmount();

    // -------------------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------------------

    /// @param _usdc           Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    /// @param _registry       Deployed KulaPublicRegistry address
    /// @param _yieldEngine    Deployed KulaYieldEngine address
    /// @param _governance     Deployed KulaGovernance address — receives TREASURY_ROLE
    constructor(
        address _usdc,
        address _registry,
        address _yieldEngine,
        address _governance
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_registry != address(0), "Invalid registry address");
        require(_yieldEngine != address(0), "Invalid yield engine address");
        require(_governance != address(0), "Invalid governance address");

        usdc = IERC20(_usdc);
        registry = IKulaPublicRegistry(_registry);
        yieldEngine = IKulaYieldEngine(_yieldEngine);

        // Grant deployer admin role for initial setup
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // CRITICAL: KulaGovernance contract address is the ONLY treasury role holder
        _grantRole(TREASURY_ROLE, _governance);
    }

    // -------------------------------------------------------------------------
    // MODIFIERS
    // -------------------------------------------------------------------------

    modifier onlyMember(uint256 _groupId) {
        if (!isMember(_groupId, msg.sender)) revert NotAMember(_groupId, msg.sender);
        _;
    }

    modifier onlyActiveGroup(uint256 _groupId) {
        if (!groups[_groupId].active) revert GroupNotActive(_groupId);
        _;
    }

    // -------------------------------------------------------------------------
    // GROUP MANAGEMENT
    // -------------------------------------------------------------------------

    /// @notice Creates a new ROSCA group. Caller becomes the treasurer and
    ///         first member. Their reputation is initialised at 50.
    /// @param _name               Human-readable group name
    /// @param _contributionAmount USDC per cycle (in 6-decimal units)
    /// @param _intervalSeconds    Cycle duration in seconds
    function createGroup(
        string calldata _name,
        uint256 _contributionAmount,
        uint256 _intervalSeconds
    ) external returns (uint256 groupId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_contributionAmount > 0, "Contribution must be > 0");
        require(_intervalSeconds >= 1 days, "Interval must be at least 1 day");

        groupCount++;
        groupId = groupCount;

        Group storage g = groups[groupId];
        g.id = groupId;
        g.name = _name;
        g.treasurer = msg.sender;
        g.contributionAmount = _contributionAmount;
        g.intervalSeconds = _intervalSeconds;
        g.active = true;
        g.lastPayoutTimestamp = block.timestamp;
        g.members.push(msg.sender);

        _initializeReputation(msg.sender);

        emit GroupCreated(groupId, _name, msg.sender);
        emit MemberJoined(groupId, msg.sender);
    }

    /// @notice Submits a join application. Existing members then vote.
    function applyToJoin(uint256 _groupId) external onlyActiveGroup(_groupId) {
        if (isMember(_groupId, msg.sender)) revert AlreadyAMember(_groupId, msg.sender);

        JoinRequest storage req = joinRequests[_groupId][msg.sender];
        req.applicant = msg.sender;
        req.votesFor = 0;
        req.votesAgainst = 0;
        req.processed = false;

        _initializeReputation(msg.sender);

        emit JoinRequestSubmitted(_groupId, msg.sender);
    }

    /// @notice Members vote to admit or reject an applicant.
    ///         Auto-admits once ADMISSION_THRESHOLD approvals are reached.
    function voteOnApplicant(
        uint256 _groupId,
        address _applicant,
        bool _support
    ) external onlyMember(_groupId) onlyActiveGroup(_groupId) {
        JoinRequest storage req = joinRequests[_groupId][_applicant];
        require(req.applicant == _applicant, "No pending application");
        require(!req.processed, "Application already processed");
        require(!req.hasVoted[msg.sender], "Already voted on this application");

        req.hasVoted[msg.sender] = true;

        if (_support) {
            req.votesFor++;
        } else {
            req.votesAgainst++;
        }

        emit JoinRequestVoted(_groupId, _applicant, msg.sender, _support);

        // Auto-admit once threshold reached
        if (req.votesFor >= ADMISSION_THRESHOLD) {
            groups[_groupId].members.push(_applicant);
            req.processed = true;
            emit MemberJoined(_groupId, _applicant);
        }
    }

    // -------------------------------------------------------------------------
    // CONTRIBUTIONS & PAYOUTS
    // -------------------------------------------------------------------------

    /// @notice Member contributes USDC to their group for the current cycle.
    ///         After deposit, checks whether idle funds exceed the 20% liquidity
    ///         buffer and pushes the surplus to KulaYieldEngine.
    /// @param _groupId  Target group
    /// @param _amount   USDC amount (must equal group.contributionAmount)
    function deposit(
        uint256 _groupId,
        uint256 _amount
    ) external nonReentrant onlyMember(_groupId) onlyActiveGroup(_groupId) {
        if (_amount == 0) revert ZeroAmount();
        Group storage g = groups[_groupId];
        require(_amount == g.contributionAmount, "Amount must match group contribution");

        // Pull USDC from sender — requires prior approval
        usdc.safeTransferFrom(msg.sender, address(this), _amount);

        g.totalContributed += _amount;
        g.currentBalance += _amount;
        cycleContributions[_groupId][msg.sender] += _amount;

        // Determine whether payment was on time
        bool onTime = block.timestamp <= g.lastPayoutTimestamp + g.intervalSeconds;
        _updateReputation(msg.sender, onTime);

        emit ContributionReceived(_groupId, msg.sender, _amount, block.timestamp);

        // --- YIELD LOGIC ---
        // If idle balance exceeds the 20% liquidity buffer, optimise
        _checkAndOptimizeLiquidity(_groupId);
    }

    /// @notice Member withdraws their own contribution if payout has not yet
    ///         occurred this cycle (emergency exit mechanism).
    function withdraw(
        uint256 _groupId,
        uint256 _amount
    ) external nonReentrant onlyMember(_groupId) onlyActiveGroup(_groupId) {
        if (_amount == 0) revert ZeroAmount();
        Group storage g = groups[_groupId];

        uint256 memberBalance = cycleContributions[_groupId][msg.sender];
        require(memberBalance >= _amount, "Insufficient contribution balance");

        cycleContributions[_groupId][msg.sender] -= _amount;
        g.currentBalance -= _amount;
        g.totalContributed -= _amount;

        // Penalise reputation for early withdrawal
        _updateReputation(msg.sender, false);

        usdc.safeTransfer(msg.sender, _amount);
    }

    /// @notice Executes the ROSCA payout to the current cycle's recipient.
    ///         ONLY callable by the KulaGovernance contract (TREASURY_ROLE).
    ///         Advances the recipient index for the next cycle.
    /// @param _groupId  Target group
    function executePayout(
        uint256 _groupId
    ) external nonReentrant onlyRole(TREASURY_ROLE) onlyActiveGroup(_groupId) {
        Group storage g = groups[_groupId];

        require(
            block.timestamp >= g.lastPayoutTimestamp + g.intervalSeconds,
            "Payout interval has not elapsed"
        );
        require(g.currentBalance > 0, "No balance available for payout");
        require(g.members.length > 0, "No members in group");

        // Determine recipient for this cycle
        uint256 recipientIdx = g.currentRecipientIndex % g.members.length;
        address recipient = g.members[recipientIdx];
        uint256 payoutAmount = g.currentBalance;

        // Advance state BEFORE transfer (CEI pattern)
        g.currentBalance = 0;
        g.currentRecipientIndex++;
        g.lastPayoutTimestamp = block.timestamp;

        // Reset cycle contributions
        for (uint256 i = 0; i < g.members.length; i++) {
            cycleContributions[_groupId][g.members[i]] = 0;
        }

        usdc.safeTransfer(recipient, payoutAmount);

        emit PayoutExecuted(_groupId, recipient, payoutAmount);
    }

    // -------------------------------------------------------------------------
    // ASSET PROPOSALS
    // -------------------------------------------------------------------------

    /// @notice Propose a community asset purchase. The asset MUST already be
    ///         verified in KulaPublicRegistry (community trust OR AI oracle).
    /// @param _groupId          Group making the purchase
    /// @param _registryAssetId  Asset ID in KulaPublicRegistry
    /// @param _description      Human-readable proposal description
    /// @param _requestedAmount  USDC amount requested from group treasury
    function proposeAsset(
        uint256 _groupId,
        uint256 _registryAssetId,
        string calldata _description,
        uint256 _requestedAmount
    ) external onlyMember(_groupId) onlyActiveGroup(_groupId) returns (uint256 proposalId) {
        // INTERFACE PROTOCOL: Gate on IKulaPublicRegistry.isVerified()
        if (!registry.isVerified(_registryAssetId)) {
            revert AssetNotVerified(_registryAssetId);
        }

        Group storage g = groups[_groupId];
        if (g.currentBalance < _requestedAmount) {
            revert InsufficientGroupBalance(g.currentBalance, _requestedAmount);
        }

        assetProposalCount++;
        proposalId = assetProposalCount;

        AssetProposal storage p = assetProposals[proposalId];
        p.groupId = _groupId;
        p.registryAssetId = _registryAssetId;
        p.proposer = msg.sender;
        p.description = _description;
        p.requestedAmount = _requestedAmount;
        p.votesFor = 0;
        p.executed = false;
        p.exists = true;

        emit AssetProposed(proposalId, _groupId, _registryAssetId);
    }

    /// @notice Group members vote to approve an asset proposal.
    ///         Once >50% of members approve, the proposal is executable
    ///         by KulaGovernance via its own executePayout flow.
    function voteOnAssetProposal(
        uint256 _proposalId,
        bool _support
    ) external {
        AssetProposal storage p = assetProposals[_proposalId];
        require(p.exists, "Proposal does not exist");
        require(!p.executed, "Proposal already executed");
        require(isMember(p.groupId, msg.sender), "Not a group member");
        require(!hasVotedOnProposal[_proposalId][msg.sender], "Already voted");

        hasVotedOnProposal[_proposalId][msg.sender] = true;

        if (_support) {
            p.votesFor++;
        }

        emit AssetProposalVoted(_proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // INTERNAL: YIELD LOGIC
    // -------------------------------------------------------------------------

    /// @notice Checks if the group's idle balance exceeds the 20% liquidity
    ///         buffer. If so, pushes the surplus to KulaYieldEngine.
    ///         Called automatically after every deposit().
    function _checkAndOptimizeLiquidity(uint256 _groupId) internal {
        Group storage g = groups[_groupId];

        // liquidityBuffer = totalContributed * 20%
        uint256 liquidityBuffer = (g.totalContributed * LIQUIDITY_BUFFER_BPS) / BPS_DENOMINATOR;

        if (g.currentBalance > liquidityBuffer) {
            uint256 surplusAmount = g.currentBalance - liquidityBuffer;

            // Update balance state BEFORE external call (CEI pattern)
            g.currentBalance -= surplusAmount;

            // Approve and send surplus to yield engine
            usdc.safeIncreaseAllowance(address(yieldEngine), surplusAmount);
            yieldEngine.optimizeLiquidity(surplusAmount);

            emit LiquidityOptimized(_groupId, surplusAmount);
        }
    }

    // -------------------------------------------------------------------------
    // INTERNAL: REPUTATION
    // -------------------------------------------------------------------------

    /// @notice Initialises a new user's reputation score at 50 (neutral).
    ///         No-op if they already have a score.
    function _initializeReputation(address _user) internal {
        if (reputations[_user].score == 0) {
            reputations[_user].score = 50;
        }
    }

    /// @notice Adjusts reputation score after a contribution or withdrawal.
    ///         On-time: +5 (capped at 100). Late/early-exit: -10 (floored at 0).
    function _updateReputation(address _user, bool _onTime) internal {
        MemberReputation storage rep = reputations[_user];

        if (_onTime) {
            rep.score = rep.score + 5 > 100 ? 100 : rep.score + 5;
            rep.consistentPayments++;
        } else {
            rep.score = rep.score < 10 ? 0 : rep.score - 10;
            rep.totalDelays++;
        }

        emit ReputationUpdated(_user, rep.score);
    }

    // -------------------------------------------------------------------------
    // VIEWS
    // -------------------------------------------------------------------------

    /// @notice Returns true if _addr is a member of _groupId
    function isMember(uint256 _groupId, address _addr) public view returns (bool) {
        address[] storage members = groups[_groupId].members;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == _addr) return true;
        }
        return false;
    }

    /// @notice Returns all member addresses for a group
    function getMembers(uint256 _groupId) external view returns (address[] memory) {
        return groups[_groupId].members;
    }

    /// @notice Returns member count for a group
    function getMemberCount(uint256 _groupId) external view returns (uint256) {
        return groups[_groupId].members.length;
    }

    /// @notice Returns the current payout recipient address for a group
    function getCurrentRecipient(uint256 _groupId) external view returns (address) {
        Group storage g = groups[_groupId];
        if (g.members.length == 0) return address(0);
        return g.members[g.currentRecipientIndex % g.members.length];
    }

    /// @notice Returns an asset proposal's vote count vs group size
    function getProposalStatus(uint256 _proposalId) external view returns (
        uint256 votesFor,
        uint256 memberCount,
        bool isApproved_
    ) {
        AssetProposal storage p = assetProposals[_proposalId];
        require(p.exists, "Proposal does not exist");
        memberCount = groups[p.groupId].members.length;
        votesFor = p.votesFor;
        // Approved when strictly more than 50% of members have voted for
        isApproved_ = memberCount > 0 && (votesFor * 2 > memberCount);
    }
}
