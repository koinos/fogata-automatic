import { Provider, Signer } from "koilib";
import { OperationJson } from "koilib/lib/interface";
import { config } from "./config";
import abiFogata from "./fogata-abi.json";
import { FogataContract } from "./interfaces";
import { TransactionsHandler } from "./TransactionsHandler";
import { log } from "./utilsFogata";

async function main() {
  const [inputNetworkName] = process.argv.slice(2);
  const networkName = inputNetworkName || "harbinger";
  const network = config.networks[networkName];
  if (!network) throw new Error(`network ${networkName} not found`);
  const provider = new Provider(network.rpcNodes);
  const manaSharer = Signer.fromWif(network.accounts.manaSharer.privateKey);
  manaSharer.provider = provider;

  if (!network.miningPools || network.miningPools.length === 0)
    throw new Error("no mining pools defined");

  const fogatas: FogataContract[] = network.miningPools.map((miningPool) => {
    const contract = new FogataContract({
      id: miningPool,
      abi: abiFogata,
      provider,
    });
    return contract;
  });

  const sleepTime = 10000;
  const txHandler = new TransactionsHandler(manaSharer, {
    txWaitingTime: config.txWaitingTime,
    retries: config.retries,
  });

  while (true) {
    for (let i = 0; i < fogatas.length; i += 1) {
      const fogata = fogatas[i];
      try {
        const { accounts } = (
          await fogata.functions.get_all_accounts<{ accounts: string[] }>()
        ).result!;

        const { result: poolState } = await fogata.functions.get_pool_state();
        log("pool state", { poolId: fogata.getId(), poolState });
        if (!poolState) continue;

        const currentSnapshot = Number(poolState.current_snapshot);
        if (currentSnapshot <= fogata.nextReburn) {
          log("wait, no time to reburn", {
            currentSnapshot,
            nextReburn: fogata.nextReburn,
          });
          continue;
        }

        fogata.options.onlyOperation = true;
        const operations: OperationJson[] = [];
        const { operation: payBeneficiaries } =
          await fogata.functions.pay_beneficiaries();
        const { operation: reburnAndSnapshot } =
          await fogata.functions.reburn_and_snapshot();
        operations.push(payBeneficiaries, reburnAndSnapshot);
        for (let i = 0; i < accounts.length; i += 1) {
          const account = accounts[i];
          const { operation } = await fogata.functions.collect({ account });
          operations.push(operation);
        }
        fogata.options.onlyOperation = false;

        txHandler.push(`collect for ${accounts.join(", ")}`, operations);
        fogata.nextReburn = Number(poolState.next_snapshot);
      } catch (error) {
        log(`error in pool ${fogata.getId()}`, {
          error: (error as Error).message,
        });
      }
    }
    await new Promise((r) => {
      setTimeout(r, sleepTime);
    });
  }
}

main()
  .then(() => {})
  .catch((error) => console.error(error));
