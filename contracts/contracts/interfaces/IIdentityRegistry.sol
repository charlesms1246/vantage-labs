// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdentityRegistry - ERC-8004 compliant agent identity interface
interface IIdentityRegistry {
    struct MetadataEntry {
        string key;
        bytes value;
    }

    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);
    event URIUpdated(uint256 indexed agentId, string newURI);
    event MetadataSet(uint256 indexed agentId, string key, bytes value);

    /// @notice Register a new agent with a URI
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Register a new agent with a URI and initial metadata
    function registerWithMetadata(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);

    /// @notice Update the agent URI
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Get metadata value for a key
    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);

    /// @notice Set metadata value for a key
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;

    /// @notice Set the agent wallet with signature verification
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;

    /// @notice Get the agent wallet address
    function getAgentWallet(uint256 agentId) external view returns (address);
}
