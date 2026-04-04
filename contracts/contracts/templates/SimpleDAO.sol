// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SimpleDAO - Token-weighted on-chain governance with time-locked execution
/// @notice Governance token holders create proposals, vote, and execute after a timelock
contract SimpleDAO {
    IERC20 public immutable governanceToken;

    uint256 public votingPeriod;   // seconds proposals stay open
    uint256 public timelockDelay;  // seconds between pass and execution
    uint256 public quorumVotes;    // minimum FOR votes needed to pass

    uint256 private _proposalCounter;

    enum ProposalState { Pending, Active, Defeated, Queued, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        address target;
        uint256 value;
        bytes callData;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 executeAfter;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) private _proposals;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalQueued(uint256 indexed proposalId, uint256 executeAfter);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    /// @param _token          ERC-20 governance token (balance = voting weight)
    /// @param _votingPeriod   Voting window in seconds (e.g. 3 days = 259200)
    /// @param _timelockDelay  Execution delay after passing in seconds (e.g. 2 days = 172800)
    /// @param _quorumVotes    Min FOR votes (in token units, no decimals scaling) to pass
    constructor(
        address _token,
        uint256 _votingPeriod,
        uint256 _timelockDelay,
        uint256 _quorumVotes
    ) {
        governanceToken = IERC20(_token);
        votingPeriod = _votingPeriod;
        timelockDelay = _timelockDelay;
        quorumVotes = _quorumVotes;
    }

    // ── Propose ───────────────────────────────────────────────────────────────

    /// @notice Create a new proposal. Proposer must hold at least 1 governance token.
    function propose(
        address target,
        uint256 value,
        bytes calldata callData,
        string calldata description
    ) external returns (uint256 proposalId) {
        require(governanceToken.balanceOf(msg.sender) >= 1e18, "SimpleDAO: insufficient tokens to propose");

        proposalId = ++_proposalCounter;
        Proposal storage p = _proposals[proposalId];
        p.id = proposalId;
        p.proposer = msg.sender;
        p.target = target;
        p.value = value;
        p.callData = callData;
        p.description = description;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalId, msg.sender, description);
    }

    // ── Vote ──────────────────────────────────────────────────────────────────

    /// @notice Cast a vote. Weight = token balance at time of vote.
    /// @param support true = FOR, false = AGAINST
    function castVote(uint256 proposalId, bool support) external {
        Proposal storage p = _proposals[proposalId];
        require(block.timestamp >= p.startTime && block.timestamp <= p.endTime, "SimpleDAO: not active");
        require(!p.hasVoted[msg.sender], "SimpleDAO: already voted");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "SimpleDAO: no voting power");

        p.hasVoted[msg.sender] = true;
        if (support) p.forVotes += weight;
        else p.againstVotes += weight;

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    // ── Queue & Execute ───────────────────────────────────────────────────────

    /// @notice Queue a passed proposal for time-locked execution
    function queue(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Active, "SimpleDAO: proposal not active/passed");
        Proposal storage p = _proposals[proposalId];
        require(block.timestamp > p.endTime, "SimpleDAO: voting not ended");
        require(p.forVotes > p.againstVotes && p.forVotes >= quorumVotes, "SimpleDAO: did not pass");

        p.executeAfter = block.timestamp + timelockDelay;
        emit ProposalQueued(proposalId, p.executeAfter);
    }

    /// @notice Execute a queued proposal after the timelock expires
    function execute(uint256 proposalId) external payable {
        Proposal storage p = _proposals[proposalId];
        require(state(proposalId) == ProposalState.Queued, "SimpleDAO: not queued");
        require(block.timestamp >= p.executeAfter, "SimpleDAO: timelock not expired");

        p.executed = true;
        (bool ok, ) = p.target.call{value: p.value}(p.callData);
        require(ok, "SimpleDAO: execution failed");
        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancel a proposal (proposer only, while still active)
    function cancel(uint256 proposalId) external {
        Proposal storage p = _proposals[proposalId];
        require(p.proposer == msg.sender, "SimpleDAO: not proposer");
        require(!p.executed && !p.cancelled, "SimpleDAO: already finalised");
        p.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = _proposals[proposalId];
        if (p.cancelled) return ProposalState.Cancelled;
        if (p.executed) return ProposalState.Executed;
        if (block.timestamp < p.endTime) return ProposalState.Active;
        if (p.forVotes <= p.againstVotes || p.forVotes < quorumVotes) return ProposalState.Defeated;
        if (p.executeAfter == 0) return ProposalState.Active; // passed but not queued yet
        return ProposalState.Queued;
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer, address target, uint256 value,
        string memory description, uint256 forVotes, uint256 againstVotes,
        uint256 endTime, bool executed, bool cancelled
    ) {
        Proposal storage p = _proposals[proposalId];
        return (p.proposer, p.target, p.value, p.description,
                p.forVotes, p.againstVotes, p.endTime, p.executed, p.cancelled);
    }
}
