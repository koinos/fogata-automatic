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
        const { result: poolState } = await fogata.functions.get_pool_state();
        log("pool state", { poolId: fogata.getId(), poolState });
        if (!poolState) continue;

        const now = Date.now();
        if (
          now >= fogata.paymentBeneficiaries.next &&
          !fogata.paymentBeneficiaries.processing
        ) {
          fogata.paymentBeneficiaries.processing = true;
          fogata.options.onlyOperation = true;
          const { operation } = await fogata.functions.pay_beneficiaries();
          fogata.options.onlyOperation = false;
          (async () => {
            try {
              await txHandler.push("pay beneficiaries", [operation]);
              log(".".repeat(200) + "pay beneficiaries done", {});
            } catch {}
            fogata.paymentBeneficiaries.processing = false;
          })();
        }

        if (now >= fogata.reburn.next && !fogata.reburn.processing) {
          fogata.reburn.processing = true;
          fogata.options.onlyOperation = true;
          const { operation } = await fogata.functions.reburn_and_snapshot();
          fogata.options.onlyOperation = false;
          (async () => {
            try {
              await txHandler.push("reburn and snapshot", [operation]);
              log(".".repeat(200) + "reburn and snapshot done", {});
              fogata.collect.next = now;
            } catch {}
            fogata.reburn.processing = false;
          })();
        }

        if (now >= fogata.collect.next && !fogata.collect.processing) {
          fogata.collect.processing = true;
          const { accounts } = (
            await fogata.functions.get_all_accounts<{ accounts: string[] }>()
          ).result!;
          fogata.options.onlyOperation = true;
          const operations: OperationJson[] = [];
          for (let i = 0; i < accounts.length; i += 1) {
            const account = accounts[i];
            const { operation } = await fogata.functions.collect({ account });
            operations.push(operation);
          }
          fogata.options.onlyOperation = false;
          (async () => {
            try {
              await txHandler.push(
                `collect for ${accounts.join(", ")}`,
                operations
              );
              log(".".repeat(200) + "collect done", {});
            } catch {}
            fogata.reburn.next = Number(poolState.next_snapshot);
            fogata.paymentBeneficiaries.next =
              fogata.reburn.next - 15 * 60 * 1000;
            fogata.collect.next = fogata.reburn.next + 15 * 60 * 1000;
            fogata.collect.processing = false;
          })();
        }
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
