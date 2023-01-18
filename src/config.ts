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
          privateKey: process.env.HARBINGER_MANA_SHARER_PRIVATE_KEY,
        },
      },
      miningPools: process.env.HARBINGER_MINING_POOL_IDS?.split(","),
    },
    mainnet: {
      rpcNodes: ["https://api.koinosblocks.com", "https://api.koinos.io"],
      accounts: {
        pools: {
          id: process.env.MAINNET_POOLS_CONTRACT_ID,
        },
        manaSharer: {
          privateKey: process.env.MAINNET_MANA_SHARER_PRIVATE_KEY,
        },
      },
      miningPools: process.env.MAINNET_MINING_POOL_IDS?.split(","),
    },
  },
  txWaitingTime: Number(process.env.TX_WAITING_TIME) || 30000,
  retries: Number(process.env.RETRIES) || 3,
};
