require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const ARC_RPC = process.env.ARC_RPC || "https://rpc.testnet.arc.network";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      // Arc is a young chain; paris avoids any dependence on newer opcodes.
      evmVersion: "paris",
    },
  },
  networks: {
    arcTestnet: {
      url: ARC_RPC,
      chainId: 5042002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: { arcTestnet: "blockscout" },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
};
