// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title VestingWallet - Linear ERC-20 vesting with cliff for team / investor allocations
/// @notice Tokens are locked until `cliffEnd`, then release linearly until `vestingEnd`
contract VestingWallet {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;

    uint256 public immutable cliffEnd;    // timestamp: no tokens before this
    uint256 public immutable vestingEnd;  // timestamp: fully vested after this
    uint256 public immutable totalAmount; // total tokens to vest

    uint256 public released;

    event TokensReleased(address indexed beneficiary, uint256 amount);

    /// @param _token       ERC-20 token to vest
    /// @param _beneficiary Recipient who can claim vested tokens
    /// @param _cliffEnd    Unix timestamp for cliff end (no tokens before)
    /// @param _vestingEnd  Unix timestamp for full vest (linear release between cliff and this)
    /// @param _totalAmount Total tokens deposited for vesting (must be transferred in separately)
    constructor(
        address _token,
        address _beneficiary,
        uint256 _cliffEnd,
        uint256 _vestingEnd,
        uint256 _totalAmount
    ) {
        require(_beneficiary != address(0), "VestingWallet: zero beneficiary");
        require(_vestingEnd > _cliffEnd, "VestingWallet: vestingEnd <= cliffEnd");
        require(_cliffEnd > block.timestamp, "VestingWallet: cliff in the past");
        require(_totalAmount > 0, "VestingWallet: zero amount");

        token = IERC20(_token);
        beneficiary = _beneficiary;
        cliffEnd = _cliffEnd;
        vestingEnd = _vestingEnd;
        totalAmount = _totalAmount;
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// @notice Amount vested so far (whether or not it has been claimed)
    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < cliffEnd) return 0;
        if (block.timestamp >= vestingEnd) return totalAmount;
        uint256 elapsed = block.timestamp - cliffEnd;
        uint256 duration = vestingEnd - cliffEnd;
        return (totalAmount * elapsed) / duration;
    }

    /// @notice Amount available to release right now
    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    // ── Release ───────────────────────────────────────────────────────────────

    /// @notice Transfer all currently vested (and unclaimed) tokens to the beneficiary
    function release() external {
        uint256 amount = releasable();
        require(amount > 0, "VestingWallet: nothing to release");
        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount);
    }
}
