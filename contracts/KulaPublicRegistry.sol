// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// =============================================================================
// FILE: contracts/KulaPublicRegistry.sol
// PURPOSE: Public RWA (Real World Asset) registry. Assets are listed by owners,
//          community-verified via voting, and can also be verified by the
//          AI Oracle backend via the verify() function. Once verified, assets
//          can be proposed for group purchase in RotaryGroup, and the owner
//          can mint a Trust Equity NFT (ERC-721) representing their asset.
//
// DUAL VERIFICATION PATHS:
//   1. Community path: 50+ community trust votes → isVerified = true
//   2. AI Oracle path: backend calls verify() with assetHash + IPFS CID
//      after GPT-4o document authenticity score > 0.85 → isVerified = true
//
// INTERFACE: Implements IKulaPublicRegistry so RotaryGroup.proposeAsset()
//            can call isVerified() and the oracle backend can call verify().
// =============================================================================

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IKulaInterfaces.sol";

contract KulaPublicRegistry is ERC721URIStorage, AccessControl, ReentrancyGuard, IKulaPublicRegistry {
    // -------------------------------------------------------------------------
    // ROLES
    // -------------------------------------------------------------------------

    /// @notice Held by the AI Oracle backend wallet. The only address
    ///         permitted to call verify() directly (bypassing community vote).
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @notice Admin role for contract management.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // CONSTANTS
    // -------------------------------------------------------------------------

    /// @notice Number of community trust votes required to auto-verify an asset
    uint256 public constant COMMUNITY_TRUST_THRESHOLD = 50;

    // -------------------------------------------------------------------------
    // DATA STRUCTURES
    // -------------------------------------------------------------------------

    /// @notice Full on-chain representation of a listed public asset
    struct PublicAsset {
        uint256 id;
        address poster;             // Original lister — only they can mint the NFT
        string title;               // Human-readable asset name
        string documentCid;         // IPFS CID of the primary document (deed/logbook)
        string oracleCid;           // IPFS CID written by AI Oracle after verification
        bytes32 assetHash;          // keccak256 of document bytes — set by oracle
        uint256 askPrice;           // Listing price in USDC (6 decimals)
        uint256 communityTrustScore;// Number of unique community votes received
        bool isVerified;            // true = passed community OR oracle verification
        bool oracleVerified;        // true = AI oracle explicitly verified this asset
        bool isMinted;              // true = Trust Equity NFT has been minted
        uint256 listedAt;           // Block timestamp of listing
    }

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    /// @notice Primary asset store — assetId => PublicAsset
    mapping(uint256 => PublicAsset) private _assets;
    uint256 public assetCount;

    /// @notice NFT token ID counter — separate from assetId
    uint256 private _tokenIds;

    /// @notice Tracks whether an address has voted on a given asset
    /// assetId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Maps assetHash to assetId for oracle deduplication
    /// Prevents two listings for the same physical document
    mapping(bytes32 => uint256) public hashToAssetId;

    /// @notice Maps NFT tokenId back to its source assetId
    mapping(uint256 => uint256) public tokenToAssetId;

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    event AssetListed(
        uint256 indexed assetId,
        address indexed poster,
        string title,
        uint256 askPrice,
        uint256 timestamp
    );
    event CommunityVoteCast(
        uint256 indexed assetId,
        address indexed voter,
        uint256 newTrustScore
    );
    event AssetVerifiedByCommunity(
        uint256 indexed assetId,
        uint256 finalTrustScore
    );
    event AssetVerifiedByOracle(
        uint256 indexed assetId,
        bytes32 indexed assetHash,
        string ipfsCID,
        address indexed oracle
    );
    event TrustEquityMinted(
        uint256 indexed assetId,
        uint256 indexed tokenId,
        address indexed owner,
        string tokenURI
    );
    event OracleRoleGranted(address indexed oracle);

    // -------------------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------------------

    error AssetDoesNotExist(uint256 assetId);
    error AlreadyVoted(uint256 assetId, address voter);
    error AssetNotVerified(uint256 assetId);
    error AssetAlreadyMinted(uint256 assetId);
    error NotAssetPoster(uint256 assetId, address caller);
    error DuplicateDocument(bytes32 assetHash, uint256 existingAssetId);
    error InvalidCID(string cid);
    error ZeroAskPrice();

    // -------------------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------------------

    /// @param _oracleWallet  The backend wallet address that will call verify().
    ///                       This should be a dedicated hot wallet whose private
    ///                       key is stored as a server environment variable.
    constructor(address _oracleWallet)
        ERC721("Kula Trust Equity", "KULA-RWA")
    {
        require(_oracleWallet != address(0), "Invalid oracle wallet");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _oracleWallet);

        emit OracleRoleGranted(_oracleWallet);
    }

    // -------------------------------------------------------------------------
    // ASSET LISTING
    // -------------------------------------------------------------------------

    /// @notice Lists a new real-world asset on the public registry.
    ///         The asset starts unverified and requires community votes OR
    ///         AI oracle verification before it can be proposed in RotaryGroup.
    /// @param _title      Human-readable asset name (e.g. "5-Acre Kitengela Plot")
    /// @param _cid        IPFS CID of the uploaded deed or logbook
    /// @param _askPrice   Desired sale price in USDC (6 decimals) — cannot be 0
    function listAsset(
        string calldata _title,
        string calldata _cid,
        uint256 _askPrice
    ) external returns (uint256 assetId) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_cid).length > 0, "CID cannot be empty");
        if (_askPrice == 0) revert ZeroAskPrice();

        assetCount++;
        assetId = assetCount;

        _assets[assetId] = PublicAsset({
            id: assetId,
            poster: msg.sender,
            title: _title,
            documentCid: _cid,
            oracleCid: "",
            assetHash: bytes32(0),
            askPrice: _askPrice,
            communityTrustScore: 0,
            isVerified: false,
            oracleVerified: false,
            isMinted: false,
            listedAt: block.timestamp
        });

        emit AssetListed(assetId, msg.sender, _title, _askPrice, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // COMMUNITY VERIFICATION PATH
    // -------------------------------------------------------------------------

    /// @notice Community members vote to verify an asset.
    ///         Each address can vote once per asset.
    ///         Auto-verifies once COMMUNITY_TRUST_THRESHOLD (50) votes reached.
    /// @param _assetId  Target asset
    function verifyAsset(uint256 _assetId) external {
        PublicAsset storage asset = _getAsset(_assetId);

        if (hasVoted[_assetId][msg.sender]) {
            revert AlreadyVoted(_assetId, msg.sender);
        }

        hasVoted[_assetId][msg.sender] = true;
        asset.communityTrustScore++;

        emit CommunityVoteCast(_assetId, msg.sender, asset.communityTrustScore);

        if (asset.communityTrustScore >= COMMUNITY_TRUST_THRESHOLD && !asset.isVerified) {
            asset.isVerified = true;
            emit AssetVerifiedByCommunity(_assetId, asset.communityTrustScore);
        }
    }

    // -------------------------------------------------------------------------
    // AI ORACLE VERIFICATION PATH — IKulaPublicRegistry.verify()
    // -------------------------------------------------------------------------

    /// @notice Called by the AI Oracle backend (ORACLE_ROLE) after GPT-4o
    ///         document authenticity score exceeds 0.85.
    ///         Sets isVerified = true and oracleVerified = true immediately,
    ///         bypassing the community vote count requirement.
    ///
    ///         The backend flow:
    ///         1. User uploads document → Express /api/verify-asset
    ///         2. File uploaded to IPFS via Pinata → ipfsCID returned
    ///         3. GPT-4o vision scores the document → score > 0.85
    ///         4. Backend computes assetHash = keccak256(fileBuffer)
    ///         5. Backend calls this function on-chain
    ///
    /// @param _assetHash  keccak256 hash of the raw document bytes
    /// @param _ipfsCID    Pinata IPFS CID of the verified document
    function verify(
        bytes32 _assetHash,
        string calldata _ipfsCID
    ) external override onlyRole(ORACLE_ROLE) {
        require(_assetHash != bytes32(0), "Invalid asset hash");
        require(bytes(_ipfsCID).length > 0, "CID cannot be empty");

        // Resolve assetId from hash — the backend must have called
        // setAssetHash() first, or we look up by hash mapping
        uint256 assetId = hashToAssetId[_assetHash];
        require(assetId != 0, "No asset registered for this hash");

        PublicAsset storage asset = _getAsset(assetId);

        // Update CID to the oracle-verified version if different
        asset.oracleCid = _ipfsCID;
        asset.assetHash = _assetHash;
        asset.isVerified = true;
        asset.oracleVerified = true;

        emit AssetVerifiedByOracle(assetId, _assetHash, _ipfsCID, msg.sender);
    }

    /// @notice Called by the asset poster (or oracle backend) to register
    ///         the document hash on-chain BEFORE the oracle calls verify().
    ///         This links the keccak256 hash of the uploaded file to the assetId.
    ///         The backend computes: ethers.keccak256(fileBuffer) and registers it.
    /// @param _assetId    Asset ID (must be poster's own listing)
    /// @param _assetHash  keccak256(fileBytes) computed off-chain
    function registerDocumentHash(
        uint256 _assetId,
        bytes32 _assetHash
    ) external {
        PublicAsset storage asset = _getAsset(_assetId);
        require(
            msg.sender == asset.poster || hasRole(ORACLE_ROLE, msg.sender),
            "Only poster or oracle can register hash"
        );
        require(_assetHash != bytes32(0), "Invalid hash");

        // Prevent two assets from sharing the same document
        uint256 existingId = hashToAssetId[_assetHash];
        if (existingId != 0 && existingId != _assetId) {
            revert DuplicateDocument(_assetHash, existingId);
        }

        hashToAssetId[_assetHash] = _assetId;
        asset.assetHash = _assetHash;
    }

    // -------------------------------------------------------------------------
    // NFT MINTING
    // -------------------------------------------------------------------------

    /// @notice Mints the Trust Equity NFT for a verified asset.
    ///         Only the original poster can mint, and only after isVerified = true.
    ///         The tokenURI points to the IPFS document CID.
    ///         Uses oracleCid if oracle-verified, else documentCid.
    /// @param _assetId  Target asset — must be verified and not yet minted
    function mintTrustEquity(uint256 _assetId) external nonReentrant returns (uint256 tokenId) {
        PublicAsset storage asset = _getAsset(_assetId);

        if (msg.sender != asset.poster) revert NotAssetPoster(_assetId, msg.sender);
        if (!asset.isVerified) revert AssetNotVerified(_assetId);
        if (asset.isMinted) revert AssetAlreadyMinted(_assetId);

        _tokenIds++;
        tokenId = _tokenIds;

        // Use oracle CID if available (higher quality verification), else community CID
        string memory cidToUse = bytes(asset.oracleCid).length > 0
            ? asset.oracleCid
            : asset.documentCid;

        string memory uri = string(abi.encodePacked("ipfs://", cidToUse));

        // CEI: update state before minting
        asset.isMinted = true;
        tokenToAssetId[tokenId] = _assetId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit TrustEquityMinted(_assetId, tokenId, msg.sender, uri);
    }

    // -------------------------------------------------------------------------
    // IKulaPublicRegistry INTERFACE IMPLEMENTATIONS
    // -------------------------------------------------------------------------

    /// @inheritdoc IKulaPublicRegistry
    /// @notice Called by RotaryGroup.proposeAsset() to gate asset proposals.
    ///         Returns true if isVerified is true (community OR oracle path).
    function isVerified(uint256 _assetId) external view override returns (bool) {
        if (_assetId == 0 || _assetId > assetCount) return false;
        return _assets[_assetId].isVerified;
    }

    /// @inheritdoc IKulaPublicRegistry
    function getAsset(uint256 _assetId) external view override returns (
        uint256 id,
        address poster,
        string memory title,
        string memory documentCid,
        uint256 askPrice,
        uint256 communityTrustScore,
        bool isVerified_,
        bool isMinted
    ) {
        PublicAsset storage asset = _getAsset(_assetId);
        return (
            asset.id,
            asset.poster,
            asset.title,
            asset.documentCid,
            asset.askPrice,
            asset.communityTrustScore,
            asset.isVerified,
            asset.isMinted
        );
    }

    // -------------------------------------------------------------------------
    // ADDITIONAL VIEWS
    // -------------------------------------------------------------------------

    /// @notice Returns the full asset struct including oracle fields
    function getFullAsset(uint256 _assetId) external view returns (PublicAsset memory) {
        return _getAsset(_assetId);
    }

    /// @notice Returns all relevant verification state for an asset in one call
    function getVerificationStatus(uint256 _assetId) external view returns (
        bool communityVerified,
        bool oracleVerified,
        uint256 communityTrustScore,
        bytes32 assetHash,
        string memory oracleCid
    ) {
        PublicAsset storage asset = _getAsset(_assetId);
        communityVerified = asset.communityTrustScore >= COMMUNITY_TRUST_THRESHOLD;
        oracleVerified = asset.oracleVerified;
        communityTrustScore = asset.communityTrustScore;
        assetHash = asset.assetHash;
        oracleCid = asset.oracleCid;
    }

    /// @notice Returns the asset ID associated with a minted NFT token
    function getAssetIdForToken(uint256 _tokenId) external view returns (uint256) {
        return tokenToAssetId[_tokenId];
    }

    // -------------------------------------------------------------------------
    // ADMIN
    // -------------------------------------------------------------------------

    /// @notice Grants ORACLE_ROLE to a new oracle wallet.
    ///         Use this if the oracle backend wallet is rotated.
    function setOracleWallet(address _newOracle) external onlyRole(ADMIN_ROLE) {
        require(_newOracle != address(0), "Invalid oracle address");
        _grantRole(ORACLE_ROLE, _newOracle);
        emit OracleRoleGranted(_newOracle);
    }

    /// @notice Revokes ORACLE_ROLE from a compromised oracle wallet.
    function revokeOracleWallet(address _oldOracle) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, _oldOracle);
    }

    // -------------------------------------------------------------------------
    // REQUIRED OVERRIDES — ERC721 + AccessControl both define supportsInterface
    // -------------------------------------------------------------------------

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPERS
    // -------------------------------------------------------------------------

    /// @dev Returns the asset storage pointer and reverts if it doesn't exist.
    function _getAsset(uint256 _assetId)
        internal
        view
        returns (PublicAsset storage asset)
    {
        if (_assetId == 0 || _assetId > assetCount) {
            revert AssetDoesNotExist(_assetId);
        }
        asset = _assets[_assetId];
    }
}
