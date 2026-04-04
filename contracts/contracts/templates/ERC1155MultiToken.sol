// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ERC1155MultiToken - Multi-token standard for fungible + non-fungible assets
/// @notice Useful for game items, editions, and mixed token collections on Flow EVM
contract ERC1155MultiToken is ERC1155, Ownable {
    string public name;
    string public symbol;

    /// @dev tokenId => total minted supply
    mapping(uint256 => uint256) public totalSupply;
    /// @dev tokenId => metadata URI override (empty = use base URI)
    mapping(uint256 => string) private _tokenURIs;

    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
    event TokenBurned(address indexed from, uint256 indexed tokenId, uint256 amount);

    /// @param baseURI Base metadata URI, e.g. "ipfs://Qm.../{id}.json"
    constructor(
        string memory _name,
        string memory _symbol,
        string memory baseURI
    ) ERC1155(baseURI) Ownable(msg.sender) {
        name = _name;
        symbol = _symbol;
    }

    /// @notice Mint `amount` copies of `tokenId` to `to` (owner only)
    function mint(address to, uint256 tokenId, uint256 amount, bytes memory data) external onlyOwner {
        _mint(to, tokenId, amount, data);
        totalSupply[tokenId] += amount;
        emit TokenMinted(to, tokenId, amount);
    }

    /// @notice Batch mint multiple token IDs in one transaction (owner only)
    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyOwner {
        _mintBatch(to, tokenIds, amounts, data);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            totalSupply[tokenIds[i]] += amounts[i];
        }
    }

    /// @notice Burn tokens from caller's own balance
    function burn(uint256 tokenId, uint256 amount) external {
        _burn(msg.sender, tokenId, amount);
        totalSupply[tokenId] -= amount;
        emit TokenBurned(msg.sender, tokenId, amount);
    }

    /// @notice Override metadata URI for a specific token ID (owner only)
    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external onlyOwner {
        _tokenURIs[tokenId] = tokenURI_;
    }

    /// @notice Update the base URI (owner only)
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _setURI(baseURI);
    }

    /// @dev Returns per-token override if set, otherwise falls back to base URI
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory override_ = _tokenURIs[tokenId];
        if (bytes(override_).length > 0) return override_;
        return super.uri(tokenId);
    }
}
