// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SampleNFT - ERC-721 with URI storage for Flow EVM
contract SampleNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /// @notice Deploy with configurable name and symbol
    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    /// @notice Mint a new NFT with a token URI (owner only)
    /// @param to Recipient address
    /// @param tokenURI_ IPFS/HTTP URI for token metadata
    /// @return tokenId The newly minted token ID
    function mint(address to, string calldata tokenURI_) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
    }
}
