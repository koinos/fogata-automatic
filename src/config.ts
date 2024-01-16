import * as dotenv from "dotenv";
import { Command } from 'commander';

const program = new Command();

program
  .name("fogata-automatic")
  .description("CLI tool to automatically trigger payments and reburns of Fogata Pools")
  .version(require('../package.json').version)

program
  .option("--network <network>", "Network to connect to (mainnet, harbinger)")
  .option("--mining-pools <ids...>", "Mining pool contract IDs to manage")
  .option("--mining-pool-names <names...>", "Mining ool contract names")
  .option("--mana-address <address>", "Address of Mana Sharer")
  .option("--mana-private-key <key>", "Private key of the Mana Sharer")
  .option("--rpc-nodes <nodes...>", "RPC Node addresses, if not setting network")
  .option("--pools-id <id>", "Contract ID of Pools contract, if not setting network");

program.parse();

dotenv.config();

let network = program.opts().network;

if (network != "mainnet" && network != "harbinger") {
  console.log("Network must be mainnet or harbinger");
  process.exit(1);
}

let rpcNodes = program.opts()["rpc-nodes"];

if (rpcNodes.length == 0) {
  if (network == "mainnet") {
    rpcNodes = [
      "https://testnet.koinosblocks.com",
      "https://harbinger-api.koinos.io",
    ];
  }
  else {
    rpcNodes = [
      "https://api.koinosblocks.com", 
      "https://api.koinos.io"
    ];
  }
}

let poolsId = program.opts()["pools-id"];

if (poolsId == null) {
  if (network == "mainnet") {
    poolsId = process.env.HARBINGER_POOLS_CONTRACT_ID || "1MmV5nzSBVGnBrjTr3B8XtA4yPs8wcSpr"
  }
  else {
    poolsId = process.env.MAINNET_POOLS_CONTRACT_ID || "1M4GSDejwQPwDvq3EVS2anjDA1rkzdwFF9"
  }
}

let miningPoolIds = program.opts()["mining-pools"];

if (miningPoolIds.length == 0) {
  if (network == "mainnet") {
    miningPoolIds = process.env.MAINNET_MINING_POOL_IDS?.split(",")
  }
  else {
    miningPoolIds = process.env.HARBINGER_MINING_POOL_IDS?.split(",");
  }
}

let miningPoolNames = program.opts()["mining-pool-names"];

if (miningPoolNames.length == 0) {
  if (network == "mainnet") {
    miningPoolNames = process.env.MAINNET_MINING_POOL_NAMES?.split(",")
  }
  else {
    miningPoolNames = process.env.HARBINGER_MINING_POOL_NAMES?.split(",")
  }
}

let manaSharerAddress = program.opts()["mana-address"];

if (manaSharerAddress == null) {
  if (network == "mainnet") {
    manaSharerAddress =
  }
}

export const config = {
  networks: {
    harbinger: {
      rpcNodes: ,
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
