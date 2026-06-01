// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal Worldcoin World ID Router interface.
 *         Full interface: https://github.com/worldcoin/world-id-contracts
 */
interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

/**
 * @title WorldIDVerifierAdapter
 * @notice Wraps the Worldcoin World ID Router to implement the IZKVerifier
 *         interface used by CrowdVault.
 *
 *         Proof encoding (abi.encode):
 *           (uint256 root, uint256 nullifierHash, uint256[8] proof)
 *
 *         Sepolia World ID Router: 0x469449f251692E0779667583026b5A1E99512157
 *
 *         Setup:
 *           1. Register an app at https://developer.worldcoin.org
 *           2. Deploy this contract with your app_id and action_id
 *           3. Call vault.addZK(address(this)) from the vault admin
 *
 *         Testing without a phone:
 *           Use the Worldcoin Developer Portal simulator to generate
 *           real on-chain proofs on Sepolia.
 */
contract WorldIDVerifierAdapter {
    IWorldID public immutable worldId;
    uint256 public immutable groupId = 1; // orb-verified humans
    uint256 public immutable externalNullifierHash;

    mapping(uint256 => bool) public usedNullifiers;

    event Verified(address indexed user, uint256 nullifierHash);

    error InvalidProof();
    error NullifierAlreadyUsed();

    constructor(address worldIdRouter_, string memory appId_, string memory actionId_) {
        worldId = IWorldID(worldIdRouter_);
        externalNullifierHash = _hashToField(
            abi.encodePacked(_hashToField(abi.encodePacked(appId_)), actionId_)
        );
    }

    /**
     * @notice Implements IZKVerifier.verify() for CrowdVault.
     * @param user   The investor's wallet address (used as the signal).
     * @param proof  ABI-encoded (uint256 root, uint256 nullifierHash, uint256[8] proof).
     *               Pass empty bytes ("0x") to skip verification (proof.length == 0
     *               is handled by CrowdVault — this function is never called in that case).
     * @return true if the World ID proof is valid and the nullifier is unused.
     */
    function verify(address user, bytes calldata proof) external returns (bool) {
        if (proof.length == 0) return false;

        (uint256 root, uint256 nullifierHash, uint256[8] memory zkProof) =
            abi.decode(proof, (uint256, uint256, uint256[8]));

        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed();

        worldId.verifyProof(
            root,
            groupId,
            _hashToField(abi.encodePacked(user)),
            nullifierHash,
            externalNullifierHash,
            zkProof
        );

        usedNullifiers[nullifierHash] = true;
        emit Verified(user, nullifierHash);
        return true;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(value)) >> 8;
    }
}
