# CrowdVault Subgraph

Indexes `CrowdVault` + `CommitmentAMM` on Sepolia and exposes:

- governance/project relationships (`Project`, `ProjectUser`, `VetoVote`)
- swap history (`Swap`)
- AMM candles (`PoolHourData`, `PoolDayData`)

## Quick Start

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

## Deploy (Graph Studio)

```bash
cd subgraph
graph auth --studio <DEPLOY_KEY>
npm run deploy:studio
```

Then set frontend env:

```bash
VITE_SUBGRAPH_URL=<your-graphql-endpoint>
```
