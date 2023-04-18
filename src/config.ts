import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  networks: {
    harbinger: {
      rpcNodes: [
        "https://testnet.koinosblocks.com",
        "https://harbinger-api.koinos.io",
      ],
      accounts: {
        pools: {
          id: process.env.HARBINGER_POOLS_CONTRACT_ID,
        },
        manaSharer: {
          address: process.env.HARBINGER_MANA_SHARER_ADDRESS,
          managerPrivateKey:
            process.env.HARBINGER_MANAGER_MANA_SHARER_PRIVATE_KEY,
        },
      },
      miningPoolIds: process.env.HARBINGER_MINING_POOL_IDS?.split(","),
      miningPoolNames: process.env.HARBINGER_MINING_POOL_NAMES?.split(","),
    },
    mainnet: {
      rpcNodes: ["https://api.koinosblocks.com", "https://api.koinos.io"],
      accounts: {
        pools: {
          id: process.env.MAINNET_POOLS_CONTRACT_ID,
        },
        manaSharer: {
          address: process.env.MAINNET_MANA_SHARER_ADDRESS,
          managerPrivateKey:
            process.env.MAINNET_MANAGER_MANA_SHARER_PRIVATE_KEY,
        },
      },
      miningPoolIds: process.env.MAINNET_MINING_POOL_IDS?.split(","),
      miningPoolNames: process.env.MAINNET_MINING_POOL_NAMES?.split(","),
    },
  },
  interval: Number(process.env.INTERVAL) || 2 * 60 * 60 * 1000,
  txWaitingTime: Number(process.env.TX_WAITING_TIME) || 30000,
  retries: Number(process.env.RETRIES) || 3,
};
