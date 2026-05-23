# Brivo USBS

Brivo's USBS smart contract suite for the **US Dollar Bonds Short Token** — a non-rebasing ERC20 token that represents an exposure to short-duration US Treasury bond ETFs (SGOV / BIL / SHV).

USBS is the most defensive product of the Brivo Treasury family: short duration, low volatility, US dollar denomination, designed to turn idle USDC into short-term bond exposure without taking material duration risk.

# Contracts

## RWAHubs

### RWAHub

**The largest and most important contract in the protocol.** `RWAHub` is an abstract contract which governs the subscription and redemption of the USBS token. It facilitates giving holders exposure to the underlying ETF basket by transferring deposited USDC to 3rd-party custodians. The hub tracks deposits and redemptions linearly. Each deposit and redemption is given a unique subscription or redemption id which is the numerical value represented as a `bytes32` object.

To mint USBS tokens, a user must send USDC to the contract and call `requestSubscription`. At some point after the funds have been off-ramped and the underlying has been purchased through the custodian, a `priceId` is set by a trusted EOA for a given `depositId` through a call to `setPriceIdForDeposits`. This `priceId` determines the exchange rate between USDC and USBS. Once the exchange rate is set, users can claim their USBS by calling `claimMint`. The price associated with each `priceId` is stored in the `Pricer.sol` contract. The hub will make **external-calls** to the pricer for retrieving prices on all mints and redemptions.

Users can also mint by sending USDC to a specified address. An EOA with the `RELAYER_ROLE` will monitor the off-chain address for deposits and add a proof of the deposit through `addProof`. The depositId will be the transaction hash of the transfer that sent USDC to the specified address. A `priceId` must also be set for these off-chain deposits.

To redeem USBS for USDC, users must burn their USBS tokens by calling `requestRedemption`. At some point after the underlying has been sold by the custodian and funds have been on-ramped to USDC, a `priceId` is set for the corresponding `redemptionId` by a trusted EOA through `setPriceIdForRedemptions`. After the `priceId` has been set for a given redemption, the user may claim their USDC through a call to `claimRedemption`.

The child contract that inherits from `RWAHub` must implement `_checkRestrictions`, which makes the same transfer checks that the RWA itself makes. This prevents invalid accounts from being able to request subscriptions or claim redemptions.

### RWAHubOffChainRedemptions

Is a child contract of `RWAHub`, which adds functionality to have users request that their redemption be serviced through an off-chain wire transfer.

## Pricer

The pricer contract sets `priceId`s for given prices. The contract expects an `rwaOracle` contract conforming to the `IRWAOracleSetter` interface, to which the pricer can update prices. Every time a price is added through `addPrice`, the pricer adds a new `priceId` with an associated price and makes an **external-call** to `setPrice` in the `rwaOracle`. If the `rwaOracle` and the pricer are not in sync with their latest prices, the pricer can catch up to the `rwaOracle`'s price with a call to `addLatestOraclePrice`. A `priceId` of 0 should never be used and clients should revert with a 0 `priceId`.

## SanctionsListClient

Contracts that want to interface with a sanctions list can do so by inheriting from `SanctionsListClient` or `SanctionsListClientUpgradeable`. The canonical [Chainalysis sanctions oracle](https://go.chainalysis.com/chainalysis-oracle-docs.html) is used as the sanctions list.

## Upgradeable Token Architecture & Factories

The USBS token and the allowlist conform to an EIP-1967 upgradeable proxy convention. Each upgradeable contract exists as an array of 3 contracts:

- `Proxy.sol`: The proxy contract
- `ProxyAdmin.sol`: The OZ Proxy Admin contract, given the ability to upgrade the implementation contract of the proxy
- `Implementation`: The contract to which `Proxy.sol` delegate calls

These upgradeable proxies are deployed through a `<>Factory.sol` contract, which handles role transfers and completes the first step of initialization.

## USBS

### USBS Token

The `USBS` contract is an upgradeable (Transparent Upgradeable Proxy) ERC20 with transfer restrictions. In order to hold, send and receive USBS a user must: (i) be on the [allowlist](contracts/usbs/allowlist/AllowlistUpgradeable.sol), (ii) not be present on the [blocklist](contracts/usbs/blocklist/Blocklist.sol), and (iii) not be on the [sanctions list](https://etherscan.io/address/0x40C57923924B5c5c5455c48D93317139ADDaC8fb). Every transfer makes an **external-call** to each of these 3 contracts.

### USBS Manager

The `USBSManager` is the gateway for minting and redeeming USBS tokens. It allows for off-chain redemptions by inheriting from `RWAHubOffChainRedemptions`. The `_checkRestrictions` function does not check whether the account is on the allowlist because a user can always add itself to the allowlist for a given term. The `USBSManager` has additional functions to set when a user can claim. For a list of `depositIds`, the `TIMESTAMP_SETTER_ROLE` sets when a user can claim the USBS they have requested to mint. The `_claimMint` function enforces that the timestamp to claim has been reached for the given `depositId`.

### Allowlist

The allowlist is an upgradeable contract that maintains a list of allowed addresses. By default, all contracts pass the allowlist check in `isAllowed`. An EOA is "allowed" if it has added itself to the allowlist for a _valid term_. A term is a string of conditions that the EOA must verify it has read and agreed to. A _valid term_ is a term that the `ALLOWLIST_ADMIN` has marked as valid. Valid terms are denoted as an array of `validIndexes` that map to valid terms in the `terms` array. The valid terms are set by the `ALLOWLIST_ADMIN` calling `setValidTermIndexes`. An EOA can add itself to the allowlist either by calling `addSelfToAllowlist` for a given term, or by passing in a signature signing a given term through `addAccountToAllowlist`.

Contracts that want to use the allowlist can do so by inheriting from `AllowlistClient` or `AllowlistClientUpgradeable` and implementing a method to set the allowlist.

### Blocklist

The blocklist is a non-upgradeable contract that maintains a list of addresses that are blocked from interacting with a set of contracts. Addresses can be added and removed by the owner of the contract. Contracts that want to use the blocklist can do so by inheriting from `BlocklistClient` or `BlocklistClientUpgradeable` and implementing a method to set the blocklist.

# Testing and Development

## Setup

- Install Node >= 16
- Run `yarn install`
- Install forge
- Copy `.env.example` to a new file `.env` in the root directory. Keep the `FORK_FROM_BLOCK_NUMBER_MAINNET` value the same. Fill in a dummy mnemonic and add an RPC URL to populate `MAINNET_RPC_URL`.
- Run `yarn init-repo`

## Commands

- Start a local blockchain: `yarn local-node`
  - The scripts under `scripts/ci/event_coverage_usbs.ts` aim to interact with the contracts in a way that maximizes the count of distinct event types emitted:

```sh
yarn hardhat run --network localhost scripts/ci/event_coverage_usbs.ts
```

- Run tests: `yarn test-forge`
- Gas report: `yarn test-forge --gas-report`

## Writing Tests and Forge Scripts

For testing with Foundry, `forge-tests/USBS_BasicDeployment.sol` is provided so users can easily deploy and set up the USBS protocol for local testing.

To set up a test file from a deployed state, include the following layout. Helper functions are provided inside the setup file.

```solidity
pragma solidity 0.8.16;

import "forge-tests/USBS_BasicDeployment.sol";

contract Test_case_someDescription is USBS_BasicDeployment {
  function testName() public {
    console.log(usbs.name());
  }
}
```

_Note_: within Foundry tests, `address(this)` is given certain permissioned roles. Use a freshly generated address when writing POCs related to bypassing access controls.

## VS Code

CTRL+Click in VS Code may not work due to the usage of relative and absolute import paths.
