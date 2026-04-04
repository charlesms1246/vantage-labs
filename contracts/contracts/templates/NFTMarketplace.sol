// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title NFTMarketplace - List and purchase ERC-721 NFTs with a platform fee
/// @notice Any ERC-721 collection can be listed here on Flow EVM
contract NFTMarketplace is ReentrancyGuard, Ownable {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;      // in wei
        bool active;
    }

    /// @dev Platform fee in basis points (e.g. 250 = 2.5%)
    uint256 public feeBps;
    uint256 public constant MAX_FEE_BPS = 1000; // 10% cap
    uint256 private _listingIdCounter;

    mapping(uint256 => Listing) public listings;

    /// @dev seller address => accumulated proceeds (pull-payment pattern)
    mapping(address => uint256) public proceeds;

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed listingId, address indexed seller);
    event PriceUpdated(uint256 indexed listingId, uint256 newPrice);
    event ProceedsWithdrawn(address indexed seller, uint256 amount);

    constructor(uint256 _feeBps) Ownable(msg.sender) {
        require(_feeBps <= MAX_FEE_BPS, "NFTMarketplace: fee too high");
        feeBps = _feeBps;
    }

    // ── Seller actions ────────────────────────────────────────────────────────

    /// @notice List an NFT for sale. Caller must have approved this contract first.
    /// @return listingId The new listing identifier
    function list(address nftContract, uint256 tokenId, uint256 price) external returns (uint256 listingId) {
        require(price > 0, "NFTMarketplace: price must be > 0");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "NFTMarketplace: not owner");
        require(nft.isApprovedForAll(msg.sender, address(this)) || nft.getApproved(tokenId) == address(this),
            "NFTMarketplace: not approved");

        listingId = ++_listingIdCounter;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });
        emit Listed(listingId, msg.sender, nftContract, tokenId, price);
    }

    /// @notice Cancel an active listing (seller only)
    function cancel(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "NFTMarketplace: not active");
        require(l.seller == msg.sender, "NFTMarketplace: not seller");
        l.active = false;
        emit Cancelled(listingId, msg.sender);
    }

    /// @notice Update the price of an active listing (seller only)
    function updatePrice(uint256 listingId, uint256 newPrice) external {
        Listing storage l = listings[listingId];
        require(l.active, "NFTMarketplace: not active");
        require(l.seller == msg.sender, "NFTMarketplace: not seller");
        require(newPrice > 0, "NFTMarketplace: price must be > 0");
        l.price = newPrice;
        emit PriceUpdated(listingId, newPrice);
    }

    // ── Buyer actions ─────────────────────────────────────────────────────────

    /// @notice Purchase a listed NFT. Send exact price in msg.value.
    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "NFTMarketplace: not active");
        require(msg.value == l.price, "NFTMarketplace: wrong price");

        l.active = false;

        uint256 fee = (l.price * feeBps) / 10_000;
        uint256 sellerProceeds = l.price - fee;

        proceeds[l.seller] += sellerProceeds;
        proceeds[owner()] += fee;

        IERC721(l.nftContract).safeTransferFrom(l.seller, msg.sender, l.tokenId);
        emit Sold(listingId, msg.sender, l.seller, l.price);
    }

    // ── Pull payment ──────────────────────────────────────────────────────────

    /// @notice Withdraw your accumulated sale proceeds
    function withdrawProceeds() external nonReentrant {
        uint256 amount = proceeds[msg.sender];
        require(amount > 0, "NFTMarketplace: no proceeds");
        proceeds[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "NFTMarketplace: transfer failed");
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    // ── Owner ─────────────────────────────────────────────────────────────────

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "NFTMarketplace: fee too high");
        feeBps = _feeBps;
    }
}
