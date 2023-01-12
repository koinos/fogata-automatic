import { Provider, Signer, Contract } from "koilib";
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

  if (!network.accounts.fogata.id)
    throw new Error(
      "the contract id of the pool is not defined in the env variables"
    );
  const fogata = new Contract({
    id: network.accounts.fogata.id,
    abi: abiFogata,
    signer: manaSharer,
    provider,
  }).functions;
  fogata.get_all_accounts = defineGetAllAccounts(fogata);

  console.log(`Fogata ${network.accounts.fogata.id} (${networkName})`);
  const { result: accounts } = await fogata.get_all_accounts();
  const { result: poolState } = await fogata.get_pool_state();
  console.log(accounts);
  console.log(poolState);
}

main()
  .then(() => {})
  .catch((error) => console.error(error));
