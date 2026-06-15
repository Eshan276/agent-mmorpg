require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const RPC_URL = process.env.MANTLE_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
// Valid-looking dummy key used only for compile tasks; real key must be set via env for deploys
const PRIVKEY = process.env.SERVER_PRIVATE_KEY
  || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    mantleSepolia: {
      url:      RPC_URL,
      accounts: [PRIVKEY],
      chainId:  5003,
    },
  },
};
