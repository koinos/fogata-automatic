import { Provider, Signer } from "koilib";
import { OperationJson } from "koilib/lib/interface";
import { config } from "./config";
import abiFogata from "./fogata-abi.json";
import { FogataContract } from "./interfaces";
import { TransactionsHandler } from "./TransactionsHandler";
import { log, sleep } from "./utilsFogata";

async function main() {

  const provider = new Provider(config.rpcNodes);
  const { manaSharer } = config.accounts;
  const managerManaSharer = Signer.fromWif(
    config.accounts.manaSharer.managerPrivateKey
  );
  managerManaSharer.provider = provider;

  const fogatas: FogataContract[] = config.miningPoolIds.map(
    (miningPool, i) => {
      const contract = new FogataContract(
        {
          id: miningPool,
          abi: abiFogata,
          provider,
        },
        config.miningPoolNames[i]
      );
      return contract;
    }
  );

  const txHandler = new TransactionsHandler(managerManaSharer, {
    txWaitingTime: config.txWaitingTime,
    retries: config.retries,
    payer: manaSharer.address,
  });

  while(true) {
    let promises: Promise<void>[] = [];
    for (let i = 0; i < fogatas.length; i += 1) {
      const fogata = fogatas[i];
      try {
        const { result: poolState } = await fogata.functions.get_pool_state();
        log("pool state", { id: fogata.name, poolState });
        if (!poolState) {
          if (!config.daemon) {
            throw new Error('unable to retrieve pool state');
          }
          continue;
        }

        const now = Date.now();
        if (
          config.pay &&
          now >= fogata.paymentBeneficiaries.next &&
          !fogata.paymentBeneficiaries.processing
        ) {
          fogata.paymentBeneficiaries.processing = true;
          fogata.options.onlyOperation = true;
          const { operation } = await fogata.functions.pay_beneficiaries();
          fogata.options.onlyOperation = false;
          promises.push((async () => {
            try {
              await txHandler.push(fogata.name, "pay beneficiaries", [
                operation,
              ]);
              fogata.paymentBeneficiaries.processing = false;
            } catch (e) {
              throw e;
            }
          })().catch((error) => {
            throw error;
          }));
        }

        if (config.reburn && now >= fogata.reburn.next && !fogata.reburn.processing) {
          fogata.reburn.processing = true;
          fogata.options.onlyOperation = true;
          const { operation } = await fogata.functions.reburn_and_snapshot();
          fogata.options.onlyOperation = false;
          promises.push((async () => {
            try {
              await txHandler.push(fogata.name, "reburn and snapshot", [
                operation,
              ]);
              fogata.collect.next = now;
              fogata.reburn.processing = false;
            } catch (e) {
              fogata.reburn.processing = false;
              throw e;
            }
          })().catch((error) => {
            throw error;
          }));
        }

        if (config.collect && now >= fogata.collect.next && !fogata.collect.processing) {
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
          promises.push((async () => {
            try {
              fogata.reburn.next = Number(poolState.next_snapshot);
              fogata.paymentBeneficiaries.next =
                fogata.reburn.next - 15 * 60 * 1000;
              fogata.collect.next = fogata.reburn.next + 15 * 60 * 1000;
              await txHandler.push(
                fogata.name,
                `collect for ${accounts.join(", ")}`,
                operations
              );
              fogata.collect.processing = false;
            } catch (e) {
              fogata.collect.processing = false;
              throw e;
            }
          })().catch((error) => {
            throw error;
          }));
        }
      } catch (error) {
        log(`error in pool ${fogata.name}`, {
          id: fogata.name,
          error: (error as Error).message,
        });
      }
    }

    for (var promise of promises) {
      try {
        await promise;
      } catch (error) {
        log(`${(error as Error).message}`, {
          error: (error as Error).message,
        });
        if (!config.daemon) {
          throw error;
        }
      }
    }

    if (!config.daemon) {
      return
    }

    log(`Next run in ${config.interval} ms`, { interval: config.interval });
    await sleep(config.interval);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  })
