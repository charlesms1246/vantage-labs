// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SampleToken - ERC-20 token with mint/burn for Flow EVM
contract SampleToken is ERC20, Ownable {
    /// @notice Deploy with name, symbol and initial supply minted to deployer
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /// @notice Mint tokens to an address (owner only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens from caller's balance
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
