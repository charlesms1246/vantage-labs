// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IReputationRegistry.sol";
import "../interfaces/IIdentityRegistry.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title ReputationRegistry - ERC-8004 compliant reputation tracking
/// @notice Stores and retrieves feedback for agents registered in IdentityRegistry
contract ReputationRegistry is IReputationRegistry, Ownable {
    /// @dev Identity registry reference
    IIdentityRegistry private _identityRegistry;

    /// @dev Whether registry has been initialized
    bool private _initialized;

    /// @dev Feedback storage: agentId => client => feedbacks
    mapping(uint256 => mapping(address => Feedback[])) private _feedbacks;

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc IReputationRegistry
    function initialize(address identityRegistry_) external override onlyOwner {
        require(!_initialized, "ReputationRegistry: already initialized");
        require(identityRegistry_ != address(0), "ReputationRegistry: zero address");
        _identityRegistry = IIdentityRegistry(identityRegistry_);
        _initialized = true;
    }

    /// @inheritdoc IReputationRegistry
    function getIdentityRegistry() external view override returns (address) {
        return address(_identityRegistry);
    }

    /// @inheritdoc IReputationRegistry
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        require(_initialized, "ReputationRegistry: not initialized");

        // Get agent owner from identity registry via ERC721
        address agentOwner = IERC721(address(_identityRegistry)).ownerOf(agentId);
        require(agentOwner != msg.sender, "ReputationRegistry: cannot self-feedback");

        Feedback memory fb = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            client: msg.sender,
            timestamp: uint64(block.timestamp)
        });

        _feedbacks[agentId][msg.sender].push(fb);

        emit NewFeedback(agentId, msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    /// @inheritdoc IReputationRegistry
    function getFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view override returns (Feedback memory) {
        require(_initialized, "ReputationRegistry: not initialized");
        Feedback[] storage feedbacks = _feedbacks[agentId][clientAddress];
        require(feedbackIndex < feedbacks.length, "ReputationRegistry: feedback index out of range");
        return feedbacks[feedbackIndex];
    }

    /// @notice Get the number of feedback entries a client has given to an agent
    function getFeedbackCount(uint256 agentId, address clientAddress) external view returns (uint256) {
        return _feedbacks[agentId][clientAddress].length;
    }
}
