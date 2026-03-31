// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TippingContract - Accept and withdraw ETH/FLOW tips for creators
contract TippingContract is ReentrancyGuard {
    /// @dev Tips accumulated per creator address
    mapping(address => uint256) private _tips;

    event TipReceived(address indexed creator, address indexed tipper, uint256 amount);
    event TipWithdrawn(address indexed creator, uint256 amount);

    /// @notice Send a tip to a creator
    /// @param creator The creator to tip
    function tip(address creator) external payable nonReentrant {
        require(msg.value > 0, "TippingContract: no value sent");
        require(creator != address(0), "TippingContract: zero address");
        _tips[creator] += msg.value;
        emit TipReceived(creator, msg.sender, msg.value);
    }

    /// @notice Withdraw accumulated tips (caller is the creator)
    function withdraw() external nonReentrant {
        uint256 amount = _tips[msg.sender];
        require(amount > 0, "TippingContract: nothing to withdraw");
        _tips[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "TippingContract: transfer failed");
        emit TipWithdrawn(msg.sender, amount);
    }

    /// @notice View accumulated tips for a creator
    function tipsFor(address creator) external view returns (uint256) {
        return _tips[creator];
    }
}
