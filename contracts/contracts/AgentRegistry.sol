// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentRegistry — on-chain index of AGENTX agents on 0G Chain.
/// Each agent registers its wallet (msg.sender or relayed via owner),
/// its ENS name on Sepolia, and its 0G Storage root hash so any 0G dApp
/// can discover and verify the agent globally.
contract AgentRegistry {
    struct AgentRecord {
        address  wallet;
        string   ensName;       // e.g. "ramu.agentx.eth"
        bytes32  storageRoot;   // 0G Storage rootHash of the agent's identity blob
        uint64   updatedAt;     // block.timestamp of last write
        uint32   totalSwaps;    // monotonic counter, useful for leaderboards
        bool     exists;
    }

    address public immutable owner;
    mapping(address => AgentRecord) public agents;
    address[] public allAgents;

    event AgentRegistered(address indexed wallet, string ensName, bytes32 storageRoot);
    event AgentUpdated   (address indexed wallet, bytes32 storageRoot, uint32 totalSwaps);

    modifier onlyOwnerOrSelf(address wallet) {
        require(msg.sender == owner || msg.sender == wallet, "not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// Server (owner) registers a new agent on behalf of its wallet, or the
    /// agent registers itself directly.
    function register(address wallet, string calldata ensName, bytes32 storageRoot)
        external
        onlyOwnerOrSelf(wallet)
    {
        AgentRecord storage rec = agents[wallet];
        if (!rec.exists) {
            allAgents.push(wallet);
        }
        rec.wallet       = wallet;
        rec.ensName      = ensName;
        rec.storageRoot  = storageRoot;
        rec.updatedAt    = uint64(block.timestamp);
        rec.exists       = true;
        emit AgentRegistered(wallet, ensName, storageRoot);
    }

    /// Push a fresh storage root + bump the swap counter. Cheap, called per swap.
    function update(address wallet, bytes32 storageRoot, uint32 totalSwaps)
        external
        onlyOwnerOrSelf(wallet)
    {
        AgentRecord storage rec = agents[wallet];
        require(rec.exists, "agent not registered");
        rec.storageRoot = storageRoot;
        rec.totalSwaps  = totalSwaps;
        rec.updatedAt   = uint64(block.timestamp);
        emit AgentUpdated(wallet, storageRoot, totalSwaps);
    }

    // ── views ────────────────────────────────────────────────────────────────

    function getAgent(address wallet) external view returns (AgentRecord memory) {
        return agents[wallet];
    }

    function totalAgents() external view returns (uint256) {
        return allAgents.length;
    }

    /// Paginated list of all registered agent wallets — keep page small to fit
    /// in a single eth_call.
    function listAgents(uint256 offset, uint256 limit)
        external view returns (address[] memory page)
    {
        uint256 end = offset + limit;
        if (end > allAgents.length) end = allAgents.length;
        if (offset > end)           end = offset;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) page[i - offset] = allAgents[i];
    }
}
