import { Provider, Signer } from "koilib";
import { OperationJson } from "koilib/lib/interface";
import { config } from "./config";
import abiFogata from "./fogata-abi.json";
import { FogataContract } from "./interfaces";
import { TransactionsHandler } from "./TransactionsHandler";
import { log, sleep } from "./utilsFogata";

async function main() {
  const [inputNetworkName] = process.argv.slice(2);
  const networkName = inputNetworkName || "harbinger";
  const network = config.networks[networkName];
  if (!network) throw new Error(`network ${networkName} not found`);
  const provider = new Provider(network.rpcNodes);
  const { manaSharer } = network.accounts;
  const managerManaSharer = Signer.fromWif(
    network.accounts.manaSharer.managerPrivateKey
  );
  managerManaSharer.provider = provider;

  if (!network.miningPoolIds || network.miningPoolIds.length === 0)
    throw new Error("no mining pools defined");

  if (
    !network.miningPoolNames ||
    network.miningPoolNames.length !== network.miningPoolIds.length
  )
    throw new Error("define the names of the mining pools");

  const fogatas: FogataContract[] = network.miningPoolIds.map(
    (miningPool, i) => {
      const contract = new FogataContract(
        {
          id: miningPool,
          abi: abiFogata,
          provider,
        },
        network.miningPoolNames[i]
      );
      return contract;
    }
  );

  const sleepTime = 2 * 60 * 60 * 1000;
  const txHandler = new TransactionsHandler(managerManaSharer, {
    txWaitingTime: config.txWaitingTime,
    retries: config.retries,
    payer: manaSharer.address,
  });

  while (true) {
    for (let i = 0; i < fogatas.length; i += 1) {
      const fogata = fogatas[i];
      try {
        const { result: poolState } = await fogata.functions.get_pool_state();
        log("pool state", { id: fogata.name, poolState });
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
              await txHandler.push(fogata.name, "pay beneficiaries", [
                operation,
              ]);
            } catch {}
            fogata.paymentBeneficiaries.processing = false;
          })().catch();
        }

        if (now >= fogata.reburn.next && !fogata.reburn.processing) {
          fogata.reburn.processing = true;
          fogata.options.onlyOperation = true;
          const { operation } = await fogata.functions.reburn_and_snapshot();
          fogata.options.onlyOperation = false;
          (async () => {
            try {
              await txHandler.push(fogata.name, "reburn and snapshot", [
                operation,
              ]);
              fogata.collect.next = now;
            } catch {}
            fogata.reburn.processing = false;
          })().catch();
        }

        if (now >= fogata.collect.next && !fogata.collect.processing) {
          fogata.collect.processing = true;
          const { accounts } = (
            await fogata.functions.get_all_accounts<{ accounts: string[] }>()
          ).result!;
          fogata.options.onlyOperation = true;
          const operations: OperationJson[] = [];
          for (let j = 0; j < accounts.length; j += 1) {
            const account = accounts[j];
            const { operation } = await fogata.functions.collect({ account });
            operations.push(operation);
          }
          fogata.options.onlyOperation = false;
          (async () => {
            try {
              await txHandler.push(
                fogata.name,
                `collect for ${accounts.join(", ")}`,
                operations
              );
            } catch {}
            fogata.reburn.next = Number(poolState.next_snapshot);
            fogata.paymentBeneficiaries.next =
              fogata.reburn.next - 15 * 60 * 1000;
            fogata.collect.next = fogata.reburn.next + 15 * 60 * 1000;
            fogata.collect.processing = false;
          })().catch();
        }
      } catch (error) {
        log(`error in pool ${fogata.name}`, {
          id: fogata.name,
          error: (error as Error).message,
        });
      }
    }
    await sleep(sleepTime);
  }
}

main()
  .then(() => {})
  .catch((error) => console.error(error));
