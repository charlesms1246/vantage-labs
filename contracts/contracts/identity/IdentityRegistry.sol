// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry - ERC-8004 compliant agent identity registry
/// @notice Manages agent identities as NFTs with associated metadata
contract IdentityRegistry is IIdentityRegistry, ERC721URIStorage, Ownable {
    using ECDSA for bytes32;

    /// @dev Counter for agent IDs
    uint256 private _nextAgentId;

    /// @dev Metadata storage: agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @dev Reserved metadata key for agent wallet
    string private constant AGENT_WALLET_KEY = "agentWallet";

    /// @dev Nonces for signature replay protection
    mapping(uint256 => uint256) private _nonces;

    constructor() ERC721("VantageAgentIdentity", "VAI") Ownable(msg.sender) {
        _nextAgentId = 1;
    }

    /// @inheritdoc IIdentityRegistry
    function register(string calldata agentURI) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, msg.sender, agentURI);
    }

    /// @inheritdoc IIdentityRegistry
    function registerWithMetadata(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key, metadata[i].value);
        }

        emit Registered(agentId, msg.sender, agentURI);
    }

    /// @inheritdoc IIdentityRegistry
    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        require(ownerOf(agentId) == msg.sender, "IdentityRegistry: not agent owner");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI);
    }

    /// @inheritdoc IIdentityRegistry
    function getMetadata(
        uint256 agentId,
        string memory metadataKey
    ) external view override returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "IdentityRegistry: agent does not exist");
        return _metadata[agentId][metadataKey];
    }

    /// @inheritdoc IIdentityRegistry
    function setMetadata(
        uint256 agentId,
        string memory metadataKey,
        bytes memory metadataValue
    ) external override {
        require(ownerOf(agentId) == msg.sender, "IdentityRegistry: not agent owner");
        require(
            keccak256(bytes(metadataKey)) != keccak256(bytes(AGENT_WALLET_KEY)),
            "IdentityRegistry: use setAgentWallet for wallet key"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataValue);
    }

    /// @inheritdoc IIdentityRegistry
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external override {
        require(ownerOf(agentId) == msg.sender, "IdentityRegistry: not agent owner");
        require(block.timestamp <= deadline, "IdentityRegistry: signature expired");

        bytes32 messageHash = keccak256(
            abi.encodePacked(agentId, newWallet, deadline, _nonces[agentId], block.chainid)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == msg.sender, "IdentityRegistry: invalid signature");

        _nonces[agentId]++;
        _metadata[agentId][AGENT_WALLET_KEY] = abi.encode(newWallet);
        emit MetadataSet(agentId, AGENT_WALLET_KEY, abi.encode(newWallet));
    }

    /// @inheritdoc IIdentityRegistry
    function getAgentWallet(uint256 agentId) external view override returns (address) {
        bytes memory walletBytes = _metadata[agentId][AGENT_WALLET_KEY];
        if (walletBytes.length == 0) return address(0);
        return abi.decode(walletBytes, (address));
    }

    /// @notice Get the current nonce for an agent (for signature replay protection)
    function getNonce(uint256 agentId) external view returns (uint256) {
        return _nonces[agentId];
    }

    /// @notice Get the next agent ID that will be assigned
    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }
}
