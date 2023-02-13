# Automatic payments in Fogata

This script allows to perform automatic payments and trigger reburns in [fogata pools](http://fogata.io).

## How to use it

Create a copy of `.env.example` and rename it as `.env` and fill the following values:

- `MAINNET_MINING_POOL_IDS`: List of mining pools separated by commas.
- `MAINNET_MINING_POOL_NAMES`: List of names for the mining pools. You can use any name for each one.
- `MAINNET_MANA_SHARER_ADDRESS`: Address of the account that will pay the mana
- `MAINNET_MANAGER_MANA_SHARER_PRIVATE_KEY`: Private key of the mana sharer. If you are using a [Mana Sharer Contract](https://github.com/joticajulian/koinos-contracts-as/blob/main/contracts/manasharer/assembly/ManaSharer.ts) then set the private key of the manager.

Run

```
yarn install
yarn build
yarn start
```

The script will start to make the payments and reburns.

## Docker

Docker container not yet available.

## References

See also:

- [Fogata Contract](https://github.com/joticajulian/fogata).
- https://fogata.io
