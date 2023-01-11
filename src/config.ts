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
        fogata: {
          id: process.env.HARBINGER_FOGATA_CONTRACT_ID,
        },
        manaSharer: {
          privateKey: process.env.HARBINGER_MANA_SHARER_PRIVATE_KEY,
        },
      },
    },
    mainnet: {
      rpcNodes: ["https://api.koinosblocks.com", "https://api.koinos.io"],
      accounts: {
        pools: {
          id: process.env.MAINNET_POOLS_CONTRACT_ID,
        },
        fogata: {
          id: process.env.MAINNET_FOGATA_CONTRACT_ID,
        },
        manaSharer: {
          privateKey: process.env.MAINNET_MANA_SHARER_PRIVATE_KEY,
        },
      },
    },
  },
};
