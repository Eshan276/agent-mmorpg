// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GoldToken.sol";

/// @title GameAMM — single multi-resource AMM, GGLD-only on-chain
/// Resources are tracked as virtual reserves identified by bytes32 IDs.
/// Agents call sell() to receive GGLD for harvested resources (minted by this contract).
/// Agents call buy() to burn GGLD and signal intent to receive a resource (server fulfills).
/// 0.3% fee on every swap, retained in reserves.
contract GameAMM is Ownable {
    GoldToken public immutable goldToken;

    struct Pool {
        uint256 reserveResource; // virtual units (1e18 each)
        uint256 reserveGold;     // GGLD wei
        bool    exists;
    }

    mapping(bytes32 => Pool) public pools;
    bytes32[] public poolIds;

    uint256 private constant FEE_NUM   = 997;
    uint256 private constant FEE_DENOM = 1000;
    uint256 private constant UNIT      = 1e18;

    event Sell(address indexed trader, bytes32 indexed resourceId, uint256 resourceAmt, uint256 goldOut);
    event Buy(address indexed trader, bytes32 indexed resourceId, uint256 goldIn, uint256 resourceAmt);
    event PoolSeeded(bytes32 indexed resourceId, uint256 resourceAmt, uint256 goldAmt);

    constructor(address goldToken_, address owner_) Ownable(owner_) {
        goldToken = GoldToken(goldToken_);
    }

    // ── Owner: seed pool ──────────────────────────────────────────────────────

    /// Seed (or add to) a pool's virtual reserves. Owner only.
    /// Gold is minted to this contract as pool liquidity.
    function seedPool(bytes32 resourceId, uint256 resourceUnits, uint256 goldUnits) external onlyOwner {
        Pool storage p = pools[resourceId];
        if (!p.exists) {
            p.exists = true;
            poolIds.push(resourceId);
        }
        uint256 goldAmt = goldUnits * UNIT;
        goldToken.mint(address(this), goldAmt);
        p.reserveResource += resourceUnits * UNIT;
        p.reserveGold     += goldAmt;
        emit PoolSeeded(resourceId, resourceUnits * UNIT, goldAmt);
    }

    // ── Agent: sell resource → receive GGLD ──────────────────────────────────

    /// Agent sells `resourceUnits` of a resource, receives GGLD.
    /// The server has already verified the agent holds the resource in inventory.
    /// `minGoldOut` is the slippage guard (in GGLD wei).
    function sell(bytes32 resourceId, uint256 resourceUnits, uint256 minGoldOut)
        external returns (uint256 goldOut)
    {
        Pool storage p = pools[resourceId];
        require(p.exists && p.reserveGold > 0, "pool not found");
        require(resourceUnits > 0, "zero input");

        uint256 amountIn        = resourceUnits * UNIT;
        uint256 amountInWithFee = amountIn * FEE_NUM;

        goldOut = (amountInWithFee * p.reserveGold)
            / (p.reserveResource * FEE_DENOM + amountInWithFee);

        require(goldOut >= minGoldOut, "slippage");
        require(goldOut < p.reserveGold, "insufficient gold reserve");

        p.reserveResource += amountIn;
        p.reserveGold     -= goldOut;

        goldToken.mint(msg.sender, goldOut);
        emit Sell(msg.sender, resourceId, amountIn, goldOut);
    }

    /// Preview sell output without executing.
    function previewSell(bytes32 resourceId, uint256 resourceUnits)
        external view returns (uint256 goldOut)
    {
        Pool storage p = pools[resourceId];
        if (!p.exists || p.reserveGold == 0) return 0;
        uint256 amountIn        = resourceUnits * UNIT;
        uint256 amountInWithFee = amountIn * FEE_NUM;
        goldOut = (amountInWithFee * p.reserveGold)
            / (p.reserveResource * FEE_DENOM + amountInWithFee);
    }

    // ── Agent: buy resource with GGLD ─────────────────────────────────────────

    /// Agent pays GGLD to buy `resourceUnits` of a resource.
    /// GGLD is burned from the agent; server delivers the item to inventory.
    function buy(bytes32 resourceId, uint256 resourceUnits, uint256 maxGoldIn)
        external returns (uint256 goldIn)
    {
        Pool storage p = pools[resourceId];
        require(p.exists && p.reserveResource > 0, "pool not found");
        require(resourceUnits > 0, "zero input");

        uint256 amountOut       = resourceUnits * UNIT;
        // Reverse x*y=k to find goldIn: goldIn = (reserveGold * amountOut * FEE_DENOM) / ((reserveResource - amountOut) * FEE_NUM) + 1
        require(amountOut < p.reserveResource, "insufficient resource reserve");
        goldIn = (p.reserveGold * amountOut * FEE_DENOM)
            / ((p.reserveResource - amountOut) * FEE_NUM) + 1;

        require(goldIn <= maxGoldIn, "slippage");
        require(goldToken.balanceOf(msg.sender) >= goldIn, "insufficient GGLD");

        p.reserveGold     += goldIn;
        p.reserveResource -= amountOut;

        goldToken.burn(msg.sender, goldIn);
        emit Buy(msg.sender, resourceId, goldIn, amountOut);
    }

    /// Preview buy cost without executing.
    function previewBuy(bytes32 resourceId, uint256 resourceUnits)
        external view returns (uint256 goldIn)
    {
        Pool storage p = pools[resourceId];
        if (!p.exists || p.reserveResource == 0) return 0;
        uint256 amountOut = resourceUnits * UNIT;
        if (amountOut >= p.reserveResource) return type(uint256).max;
        goldIn = (p.reserveGold * amountOut * FEE_DENOM)
            / ((p.reserveResource - amountOut) * FEE_NUM) + 1;
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /// Spot sell price: GGLD wei per 1 resource unit (1e18 scaling).
    function getPrice(bytes32 resourceId) external view returns (uint256) {
        Pool storage p = pools[resourceId];
        if (!p.exists || p.reserveResource == 0) return 0;
        return (p.reserveGold * UNIT) / p.reserveResource;
    }

    function getAllPoolIds() external view returns (bytes32[] memory) {
        return poolIds;
    }
}
