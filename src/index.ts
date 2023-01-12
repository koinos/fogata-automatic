import { Provider, Signer, Contract } from "koilib";
import { OperationJson } from "koilib/lib/interface";
import { config } from "./config";
import abiFogata from "./fogata-abi.json";
import { defineGetAllAccounts } from "./utilsFogata";

const [inputNetworkName] = process.argv.slice(2);

async function main() {
  const networkName = inputNetworkName || "harbinger";
  const network = config.networks[networkName];
  if (!network) throw new Error(`network ${networkName} not found`);
  const provider = new Provider(network.rpcNodes);
  const manaSharer = Signer.fromWif(network.accounts.manaSharer.privateKey);
  manaSharer.provider = provider;

  if (!network.accounts.fogata.id)
    throw new Error(
      "the contract id of the pool is not defined in the env variables"
    );
  const fogata = new Contract({
    id: network.accounts.fogata.id,
    abi: abiFogata,
    signer: manaSharer,
    provider,
  });
  fogata.functions.get_all_accounts = defineGetAllAccounts(fogata.functions);

  console.log(`Fogata ${network.accounts.fogata.id} (${networkName})`);
  const { accounts } = (
    await fogata.functions.get_all_accounts<{ accounts: string[] }>()
  ).result!;
  // const { result: poolState } = await fogata.functions.get_pool_state();

  fogata.options.onlyOperation = true;
  const operations: OperationJson[] = [];
  for (let i = 0; i < accounts.length; i += 1) {
    const account = accounts[i];
    const { operation } = await fogata.functions.collect({ account });
    operations.push(operation);
  }
  const tx = await manaSharer.prepareTransaction({ operations });
  await manaSharer.signTransaction(tx);
  const result = await provider.sendTransaction(tx);
  console.log(tx);
  console.log(result);
}

main()
  .then(() => {})
  .catch((error) => console.error(error));
