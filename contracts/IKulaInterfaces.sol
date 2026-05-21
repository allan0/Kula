// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// =============================================================================
// FILE: contracts/IKulaInterfaces.sol
// PURPOSE: Canonical interface definitions for the entire Kula protocol.
//          All cross-contract calls go through these interfaces to prevent
//          tight coupling and enable upgradability.
// =============================================================================

/// @notice Interface for the KulaPublicRegistry RWA NFT contract
interface IKulaPublicRegistry {
    /// @notice Returns true if the asset with _assetId has passed
    ///         community trust threshold (communityTrustScore >= 50)
    ///         OR has been verified by the AI oracle.
    function isVerified(uint256 _assetId) external view returns (bool);

    /// @notice Called by the AI oracle backend once document authenticity
    ///         score exceeds 0.85. Records the IPFS CID on-chain.
    /// @param _assetHash   keccak256 hash of the raw document bytes
    /// @param _ipfsCID     Pinata/IPFS CID string (e.g. "QmXyz...")
    function verify(bytes32 _assetHash, string calldata _ipfsCID) external;

    /// @notice Returns the full asset struct data for a given asset ID
    function getAsset(uint256 _assetId) external view returns (
        uint256 id,
        address poster,
        string memory title,
        string memory documentCid,
        uint256 askPrice,
        uint256 communityTrustScore,
        bool isVerified_,
        bool isMinted
    );
}

/// @notice Interface for the KulaYieldEngine Aave liquidity manager
interface IKulaYieldEngine {
    /// @notice Deposits idle ROSCA funds above the liquidity buffer into Aave
    /// @param _amount  Amount of USDC (6 decimals) to supply to Aave
    function optimizeLiquidity(uint256 _amount) external;

    /// @notice Withdraws principal + yield from Aave back to caller
    /// @param _principal  Original amount deposited (used to compute yield)
    function harvestYield(uint256 _principal) external;

    /// @notice Returns total USDC currently managed by the engine
    function totalManaged() external view returns (uint256);
}

/// @notice Interface for the KulaGovernance contract
interface IKulaGovernance {
    /// @notice Returns true if proposal _proposalId has been approved
    ///         (votes > 50% of group members) and is ready for execution
    function isApproved(uint256 _proposalId) external view returns (bool);

    /// @notice Executes an approved payout proposal — transfers funds
    ///         to the proposal recipient. Requires TREASURY_ROLE.
    function executePayout(uint256 _proposalId) external;
}

/// @notice Minimal ERC-4337 IAccount interface for Smart Account compatibility
interface IAccount {
    /// @notice Entry point calls this to validate a UserOperation
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

/// @notice Packed UserOperation struct as defined in ERC-4337 v0.7 (EntryPoint v0.7)
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;   // verificationGasLimit | callGasLimit packed
    uint256 preVerificationGas;
    bytes32 gasFees;            // maxFeePerGas | maxPriorityFeePerGas packed
    bytes paymasterAndData;
    bytes signature;
}
