// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReputationRegistry - ERC-8004 compliant reputation interface
interface IReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        address client;
        uint64 timestamp;
    }

    event NewFeedback(
        uint256 indexed agentId,
        address indexed client,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    /// @notice Initialize with identity registry address
    function initialize(address identityRegistry_) external;

    /// @notice Get the identity registry address
    function getIdentityRegistry() external view returns (address);

    /// @notice Submit feedback for an agent
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Get feedback entry for an agent
    function getFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (Feedback memory);
}
