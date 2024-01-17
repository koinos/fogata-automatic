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
  .option("--pools-id <id>", "Contract ID of Pools contract, if not setting network")
  .option("--no-pay", "Do not pay beneficiaries of mining pools")
  .option("--pay", "Pay beneficiaries of mining pools (default)")
  .option("--no-reburn", "Do not reburn KOIN in mining pools")
  .option("--reburn", "Reburn KOIN in mining pools (default)")
  .option("--no-collect", "Do not collect KOIN in mining pools")
  .option("--collect", "Collect KOIN in mining pools (default)")
  .option("--no-daemon", "Do not run the script as a daemon")
  .option("--daemon <bool>", "Run the script as a daemon (default)")
  .option("--interval <seconds>", "Interval between runs (if running as a daemon).")
  .option("--tx-wait-time <seconds>", "Time to wait for a transaction confirmation")
  .option("--retries <retries>", "Number of times to retry a transaction.");

program.parse();
let options = program.opts();

dotenv.config();

let network = options.network;

if (!network) {
  network = "harbinger";
}

if (network != "mainnet" && network != "harbinger") {
  console.error("Network must be mainnet or harbinger");
  process.exit(1);
}

let rpcNodes = options.rpcNodes;

if (!rpcNodes || rpcNodes.length == 0) {
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

let poolsId = options.poolsId;

if (!poolsId) {
  if (network == "mainnet") {
    poolsId = process.env.HARBINGER_POOLS_CONTRACT_ID || "1MmV5nzSBVGnBrjTr3B8XtA4yPs8wcSpr";
  }
  else {
    poolsId = process.env.MAINNET_POOLS_CONTRACT_ID || "1M4GSDejwQPwDvq3EVS2anjDA1rkzdwFF9";
  }
}

let miningPoolIds = options.miningPools;

if (!miningPoolIds || miningPoolIds.length === 0) {
  if (network == "mainnet") {
    miningPoolIds = process.env.MAINNET_MINING_POOL_IDS?.split(',');
  }
  else {
    miningPoolIds = process.env.HARBINGER_MINING_POOL_IDS?.split(',');
  }
}

if (!miningPoolIds || miningPoolIds.length === 0) {
  console.error("no mining pools defined");
  process.exit(1);
}

let miningPoolNames = options.miningPoolNames;

if (!miningPoolNames || miningPoolNames.length === 0) {
  if (network == "mainnet") {
    miningPoolNames = process.env.MAINNET_MINING_POOL_NAMES?.split(",")
  }
  else {
    miningPoolNames = process.env.HARBINGER_MINING_POOL_NAMES?.split(",")
  }
}

if (!miningPoolNames || miningPoolNames.length !== miningPoolIds.length) {
  console.error("mining pool names are misconfigured");
  process.exit(1);
}

let manaSharerAddress = options.manaAddress;

if (!manaSharerAddress) {
  if (network == "mainnet") {
    manaSharerAddress = process.env.MAINNET_MANA_SHARER_ADDRESS;
  }
  else {
    manaSharerAddress = process.env.HARBINGER_MANA_SHARER_ADDRESS
  }
}

if (!manaSharerAddress) {
  console.error("no mana sharer address defined");
  process.exit(1);
}

let manaSharerPrivateKey = options.manaPrivateKey;

if (!manaSharerPrivateKey) {
  if (network == "mainnet") {
    manaSharerPrivateKey = process.env.MAINNET_MANAGER_MANA_SHARER_PRIVATE_KEY;
  }
  else {
    manaSharerPrivateKey = process.env.HARBINGER_MANAGER_MANA_SHARER_PRIVATE_KEY;
  }
}

if (!manaSharerPrivateKey) {
  console.error("no mana sharer private key defined");
  process.exit(1);
}

let daemon = options.daemon;
let pay = options.pay;
let reburn = options.reburn;
let collect = options.collect;

let interval = options.interval;

if (!interval) {
  interval = process.env.INTERVAL || 2 * 60 * 60 * 1000;
}

let txWaitingTime = options.txWaitTime;

if (!txWaitingTime) {
  txWaitingTime = process.env.TX_WAITING_TIME || 30000;
}

let retries = options.retries;

if (!retries) {
  retries = process.env.RETRIES || 3;
}

export const config = {
  rpcNodes: rpcNodes,
  accounts: {
    pools: {
      id: poolsId
    },
    manaSharer: {
      address: manaSharerAddress,
      managerPrivateKey: manaSharerPrivateKey
    },
  },
  miningPoolIds: miningPoolIds,
  miningPoolNames: miningPoolNames,
  daemon: daemon,
  pay: pay,
  reburn: reburn,
  collect: collect,
  interval: Number(interval),
  txWaitingTime: Number(txWaitingTime),
  retries: Number(retries),
};
