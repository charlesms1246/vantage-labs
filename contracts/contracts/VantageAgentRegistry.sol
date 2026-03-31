// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIdentityRegistry.sol";

/// @title VantageAgentRegistry - Wrapper for registering Vantage Labs agents
/// @notice Manages registration and lookup of the 4 Vantage agents on-chain
contract VantageAgentRegistry is Ownable {
    /// @dev Identity registry reference
    IIdentityRegistry private immutable _identityRegistry;

    /// @dev Mapping from agent name hash to agent ID
    mapping(bytes32 => uint256) private _agentIdByName;

    /// @dev Mapping from agent ID to role
    mapping(uint256 => string) private _agentRoles;

    /// @dev Mapping from agent ID to model
    mapping(uint256 => string) private _agentModels;

    /// @dev Set of registered Vantage agent IDs
    mapping(uint256 => bool) private _isVantageAgent;

    event VantageAgentRegistered(
        uint256 indexed agentId,
        string name,
        string role,
        string model,
        string agentURI
    );

    constructor(address identityRegistry_) Ownable(msg.sender) {
        require(identityRegistry_ != address(0), "VantageAgentRegistry: zero address");
        _identityRegistry = IIdentityRegistry(identityRegistry_);
    }

    /// @notice Register a Vantage agent in the identity registry
    /// @param name The agent name (e.g., "Eric", "Harper", "Rishi", "Yasmin")
    /// @param role The agent role description
    /// @param model The AI model used by the agent
    /// @param agentURI URI pointing to agent registration JSON
    /// @return agentId The assigned agent ID
    function registerVantageAgent(
        string calldata name,
        string calldata role,
        string calldata model,
        string calldata agentURI
    ) external onlyOwner returns (uint256 agentId) {
        bytes32 nameHash = keccak256(bytes(name));
        require(_agentIdByName[nameHash] == 0, "VantageAgentRegistry: agent already registered");

        agentId = _identityRegistry.register(agentURI);

        _agentIdByName[nameHash] = agentId;
        _agentRoles[agentId] = role;
        _agentModels[agentId] = model;
        _isVantageAgent[agentId] = true;

        emit VantageAgentRegistered(agentId, name, role, model, agentURI);
    }

    /// @notice Look up an agent ID by name
    function getAgentByName(string calldata name) external view returns (uint256 agentId) {
        agentId = _agentIdByName[keccak256(bytes(name))];
        require(agentId != 0, "VantageAgentRegistry: agent not found");
    }

    /// @notice Check if an agent ID belongs to a Vantage agent
    function isVantageAgent(uint256 agentId) external view returns (bool) {
        return _isVantageAgent[agentId];
    }

    /// @notice Get the role of a Vantage agent
    function getAgentRole(uint256 agentId) external view returns (string memory) {
        require(_isVantageAgent[agentId], "VantageAgentRegistry: not a Vantage agent");
        return _agentRoles[agentId];
    }

    /// @notice Get the model of a Vantage agent
    function getAgentModel(uint256 agentId) external view returns (string memory) {
        require(_isVantageAgent[agentId], "VantageAgentRegistry: not a Vantage agent");
        return _agentModels[agentId];
    }

    /// @notice Get the identity registry address
    function getIdentityRegistry() external view returns (address) {
        return address(_identityRegistry);
    }
}
