<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity&logoColor=white" />
  <img src="https://img.shields.io/badge/Hardhat-3.x-F7DF1E?logo=ethereum&logoColor=black" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Wagmi-2.x-3C3C3D?logo=walletconnect&logoColor=white" />
  <img src="https://img.shields.io/badge/The%20Graph-Studio-6747ED?logo=graphql&logoColor=white" />
  <img src="https://img.shields.io/badge/Network-Sepolia-3C3C3D?logo=ethereum&logoColor=white" />
</p>

<h1 align="center">CrowdFundingDS</h1>

<p align="center">
  <b>Decentralized Crowdfunding with Milestone Governance, AMM Trading, and Yield Distribution</b>
</p>

<p align="center">
  <a href="#how-it-works">How It Works</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#smart-contract-configurations">Configurations</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#deployed-contracts">Contracts</a>
</p>

---

## What is CrowdFundingDS?

**CrowdFundingDS** is a full-stack decentralized crowdfunding platform built on Ethereum (Sepolia testnet). It combines:

- **Milestone-based fundraising** with on-chain governance
- **Constant-product AMM** for trading project commitment tokens post-funding
- **Yield farming** through a mock lending module for idle capital
- **Backer veto power** to prevent fund misuse
- **World ID integration** for optional sybil resistance
- **Revenue sharing** from project revenue back to token holders

Founders create projects with milestones. Backers invest USDC and receive **COMMIT tokens** (ERC-1155). Once funding closes, founders verify milestones and release funds. After all milestones complete, an **AMM pool** opens so backers can trade their tokens freely.

---

## How It Works

The full lifecycle of a project on CrowdFundingDS:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Founder   │────▶│    Admin     │────▶│   Backers   │────▶│  Funding     │
│   Creates   │     │   Approves   │     │   Invest     │     │  Closes      │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       │                                                           │
       ▼                                                           ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Milestone  │────▶│   Backers    │────▶│   Funds     │────▶│    AMM       │
│  Verified   │     │   Vote/Veto  │     │  Released   │     │  Opens       │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
       │                                                           │
       ▼                                                           ▼
┌─────────────┐                                             ┌──────────────┐
│  Yield      │                                             │  Tokens      │
│  Harvested  │                                             │  Traded      │
└─────────────┘                                             └──────────────┘
```

### Step-by-Step Flow

| Step | Actor | Action | Contract Function |
|------|-------|--------|-------------------|
| 1 | **Founder** | Creates project with milestones, funding goal, and deadline | `CrowdVault.createProject()` |
| 2 | **Admin** | Approves project for public investment | `CrowdVault.approveProject()` |
| 3 | **Backers** | Invest USDC, receive COMMIT tokens | `CrowdVault.invest()` |
| 4 | **Time** | Funding deadline passes, goal met | Automatic state transition |
| 5 | **Founder** | Verifies first milestone | `CrowdVault.claimInitialMilestoneRelease()` |
| 6 | **Founder** | Subits next milestone | `CrowdVault.verifyNextMilestone()` |
| 7 | **Founder** | Requests fund release for backers to vote | `CrowdVault.requestRelease()` |
| 8 | **Backers** | Vote to approve early release or veto | `CrowdVault.approveRelease()` / `veto()` |
| 9 | **Founder** | Executes release after veto window | `CrowdVault.executeRelease()` |
| 10 | **System** | All milestones done → AMM seeded | `CommitmentAMM.seedFromVault()` |
| 11 | **Anyone** | Trades COMMIT tokens ↔ USDC | `swapUsdcForCommit()` / `swapCommitForUsdc()` |
| 12 | **Backers** | Claims yield from lender | `CrowdVault.claimYield()` |

### Key Governance Mechanisms

- **Veto Window**: 3 days after release request. Backers with 30% stake can veto.
- **Early Release**: 30% backer approval allows funds to release before the veto window ends.
- **Milestone Timeout**: If a founder misses their milestone deadline, any backer can trigger a governance vote to extend or terminate the project.
- **Refund**: If funding goal is not met by deadline, backers can claim refunds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Home    │  │  AMM     │  │ Portfolio│  │ Dashboard│  │MyProjects│   │
│  │(Markets) │  │ (Swap)   │  │(Yield)   │  │ (Admin)  │  │(Founder) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴─────────────┴─────────────┴─────────────┘           │
│                              Wagmi + RainbowKit                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ RPC
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SMART CONTRACTS (Solidity)                         │
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │ CrowdVault  │◄──►│ Commitment  │◄──►│ Commitment  │◄──►│  Revenue  │  │
│   │  (core)     │    │   Token     │    │    AMM      │    │  Router   │  │
│   └──────┬──────┘    └─────────────┘    └─────────────┘    └───────────┘  │
│          │                                                                  │
│          ├────────────► MockLender (yield)                                 │
│          ├────────────► MockZKVerifier (KYC)                                │
│          └────────────► WorldIDVerifierAdapter (sybil resistance)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Events
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBGRAPH (The Graph Studio)                         │
│                                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ Project  │  │Investment│  │   Swap   │  │PoolHour  │  │PoolDay   │     │
│   │  Data    │  │  Data    │  │  Data    │  │  Data    │  │  Data    │     │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

Before diving into the code, here are the key DeFi primitives this project uses:

### CommitToken (ERC-1155)

The `CommitmentToken` is an **ERC-1155 multi-token contract** that represents backer stakes in individual projects.

#### Why We Use ERC-1155

Each project on CrowdFundingDS has its own token class — backers who invest in Project #3 receive **COMMIT tokens with token ID = 3**. This design lets us:

- **Track ownership per-project** — each token ID maps to exactly one project
- **Batch operations** — ERC-1155 allows transferring multiple token types in a single transaction
- **Unified interface** — one contract handles all projects instead of deploying a new ERC-20 for each
- **AMM compatibility** — the AMM swaps specific project tokens using their ID

When a backer invests `100 USDC` in Project #3, they receive `100 COMMIT` tokens (token ID 3). These tokens serve as:
- **Proof of stake** — used to calculate voting power in governance (veto, approve release)
- **Yield entitlement** — backers claim yield proportional to their token balance
- **Trading asset** — after milestones complete, tokens trade on the AMM

### CrowdVault

The `CrowdVault` is the **core orchestration contract** that manages the entire crowdfunding lifecycle.

#### What It Does

The vault is the single entry point for all major operations:

```
┌─────────────────────────────────────────────────────┐
│                    CrowdVault                         │
│                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│   │  Project    │  │  Funding    │  │ Milestone   │  │
│   │  Registry   │  │  Management │  │  Governance │  │
│   └─────────────┘  └─────────────┘  └─────────────┘  │
│          │                │                │          │
│          ▼                ▼                ▼          │
│   ┌─────────────────────────────────────────────┐    │
│   │          USDC Custody & Routing               │    │
│   └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Key responsibilities:**

- **Project lifecycle**: Creates, approves, and tracks projects with milestones
- **Funding custody**: Holds all USDC deposits from backers during the funding round
- **Governance**: Manages veto votes, approval votes, and timeout resolutions
- **Fund releases**: Calculates releasable amounts and routes them to treasuries (minus fees)
- **AMM seeding**: After milestones complete, sends USDC + minted COMMIT tokens to the AMM
- **Yield distribution**: Harvests yield from the lender and lets backers claim their share
- **KYC verification**: Accepts proofs from ZK verifiers to gate investment access

Every USDC that enters or leaves the system flows through the vault. It is the **single source of truth** for project state, backer stakes, and fund movements.

### AMM (Automated Market Maker)

The `CommitmentAMM` is a **constant-product AMM** (`x * y = k`) that allows trading project COMMIT tokens against USDC.

#### Why We Use an AMM

After a project completes all milestones and releases all funds, backers still hold **COMMIT tokens** — but the project treasury no longer needs those USDC deposits. Without a secondary market, backers would be stuck with illiquid tokens.

The AMM creates a **liquid exit path**:
- **Backers can sell** their COMMIT tokens back to USDC at any time
- **New buyers can enter** and speculate on project success
- **Price discovery** happens naturally through supply and demand in the pool
- **No order books or matching** — the pool automatically quotes prices

Unlike listing on a centralized exchange or an external DEX (like Uniswap), this **built-in AMM** is purpose-built for project tokens and seeded automatically by the vault, ensuring liquidity exists from day one.

#### How It Works

When a project finishes its final milestone, the vault automatically seeds the AMM pool:

```
All milestones complete
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CrowdVault  │────▶│ Commitment  │────▶│    AMM      │
│  (releases   │     │   Token     │     │   Pool      │
│   final funds)│     │ (mint tokens)│     │ (seeded with│
└─────────────┘     └─────────────┘     │  USDC + COMMIT)│
                                        └──────┬──────┘
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                        ┌──────────┐    ┌──────────┐    ┌──────────┐
                        │  Backer  │    │  Backer  │    │  New     │
                        │  Sells   │    │  Buys    │    │  Buyer   │
                        │  COMMIT  │    │  More    │    │  Enters  │
                        └──────────┘    └──────────┘    └──────────┘
```

#### Mechanics

- **Pool formula**: `reserve_USDC * reserve_COMMIT = constant` — as one token is bought, its price rises
- **Fee**: 0.30% per swap, configurable by admin (max 10%)
- **Price discovery**: No external oracle — price is determined purely by pool reserves
- **Liquidity**: Single-sided seeding from the vault. No LP tokens, no impermanent loss for backers
- **Slippage**: Large trades move the price more. UI shows estimated slippage before execution.

### Lender (Yield Module)

The `MockLender` is a testing module that simulates a DeFi lending protocol. The vault deposits idle USDC into the lender, which generates yield that backers can claim proportionally to their COMMIT holdings.

#### Why We Use a Lender

When backers invest USDC into a project, their capital sits in the `CrowdVault` between the **funding close** and **milestone releases**. During this period — which can span weeks or months — that capital is effectively **idle**. Instead of letting it sit unused, CrowdFundingDS deposits it into a lending protocol to **generate yield**.

This creates a **win-win**:
- **Backers earn passive yield** proportional to their COMMIT holdings, rewarding them for locking capital
- **Founders benefit** from a more attractive platform where investors are incentivized to commit early
- **Capital efficiency** — no dollar sits idle; every invested USDC works while waiting for milestone completion

In a production environment, this would integrate with **Aave** or **Compound**. For testing on Sepolia, `MockLender` simulates this behavior.

#### How Yield Flows

```
Backers invest USDC
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CrowdVault  │────▶│ MockLender  │────▶│  Yield      │
│  (holds      │     │ (deposits    │     │  Harvested  │
│   principal) │     │  principal)  │     │  by vault    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │  Backers    │
                                         │  Claim      │
                                         │  (pro-rata) │
                                         └─────────────┘
```

#### Yield Generation Methods

The `MockLender` supports two ways to generate test yield:

1. **Direct injection**: Admin calls `addYield()` to instantly deposit USDC as accrued yield
2. **Reserve dripping**: Admin funds a reserve pool, then `dripReserveYield()` moves a small portion (`dripBps = 0.01%` of total supplied) into claimable yield on each call. This simulates slow, steady yield accrual like a real lending market.

Backers claim their proportional share of harvested yield through `CrowdVault.claimYield()`. The yield is distributed based on COMMIT token holdings — the more you invested, the more yield you earn.

### The Graph (Subgraph)

A **subgraph** indexes on-chain events into a queryable GraphQL API. Instead of reading blockchain state directly (slow, expensive), the frontend queries the subgraph for:

- Project listings and funding status
- Swap history and price candles
- Backer investment data
- Governance votes

The subgraph listens to `CrowdVault` and `CommitmentAMM` events and transforms them into entities like `Project`, `Swap`, `PoolHourData`, etc.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contracts** | Solidity 0.8.28, Hardhat 3, Ethers v6 |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| **Web3** | Wagmi 2, RainbowKit, Viem |
| **State Management** | Redux Toolkit |
| **Data** | The Graph (Subgraph), Apollo Client |
| **Network** | Sepolia Testnet |
| **Token** | Sepolia USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) |

---

## Project Structure

```
CrowdFundingDS/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── config/              # Contract addresses & ABIs
│   │   ├── hooks/               # Custom Wagmi/data hooks
│   │   ├── pages/               # Route pages (Home, AMM, Portfolio, etc.)
│   │   ├── store/               # Redux Toolkit slices
│   │   └── lib/                 # Apollo client, utilities
│   ├── .env.example             # Env template
│   └── package.json
├── smartcontract/               # Hardhat 3 project
│   ├── contracts/               # Solidity contracts
│   │   ├── CrowdVault.sol       # Core crowdfunding logic
│   │   ├── CommitmentAMM.sol    # AMM for token trading
│   │   ├── CommitmentToken.sol  # ERC-1155 project tokens
│   │   ├── RevenueRouter.sol    # Revenue distribution
│   │   ├── MockLender.sol       # Yield farming simulation
│   │   ├── MockZKVerifier.sol   # KYC verification stub
│   │   └── WorldIDVerifierAdapter.sol # World ID integration
│   ├── scripts/                 # Deployment & test scripts
│   │   ├── deploy.ts            # Full deployment script
│   │   ├── seed-yield.ts        # Seed lender with yield
│   │   ├── check-yield.ts       # Check yield status
│   │   └── simulate-amm-trades.ts # Simulate AMM activity
│   ├── test/                    # E2E tests
│   ├── .env.example             # Env template
│   └── hardhat.config.ts
└── subgraph/                    # The Graph subgraph
    ├── src/mapping.ts           # Event handlers
    ├── subgraph.yaml            # Subgraph manifest
    ├── schema.graphql           # GraphQL schema
    └── package.json
```

---

## Smart Contract Configurations

These are the key configurable parameters hardcoded or set during deployment:

### CrowdVault

| Parameter | Value | Description |
|-----------|-------|-------------|
| `VETO_WINDOW` | `3 days` | Time backers have to veto a release request |
| `VETO_THRESHOLD_BPS` | `3000` (30%) | Stake % required to successfully veto |
| `APPROVAL_THRESHOLD_BPS` | `3000` (30%) | Stake % required for early release approval |
| `DEFAULT_FUNDING_DEADLINE` | `30 days` | Default time for funding round |
| `MAX_FUNDING_DEADLINE` | `90 days` | Maximum allowed funding deadline |
| `MIN_MILESTONE_WINDOW` | `7 days` | Minimum time per milestone |
| `MAX_MILESTONE_WINDOW` | `180 days` | Maximum time per milestone |
| `releaseFeeBps` | `100` (1%) | Fee on fund releases (configurable ≤10%) |
| `ammSeedBps` | `1000` (10%) | % of raised funds seeded to AMM (configurable ≤30%) |
| `projectSubmissionFee` | `0` | USDC fee to create project (configurable) |

### CommitmentAMM

| Parameter | Value | Description |
|-----------|-------|-------------|
| `feeBps` | `30` (0.30%) | Swap fee, configurable by admin (max 10%) |

### MockLender

| Parameter | Value | Description |
|-----------|-------|-------------|
| `apyBps` | `0` | Display APY label (configurable) |
| `dripBps` | `1` (0.01%) | Reserve drip rate per call |

### RevenueRouter

| Parameter | Value | Description |
|-----------|-------|-------------|
| `backersBps` | `1000` (10%) | % of revenue routed to backers (set at deploy) |

### WorldIDVerifierAdapter

| Parameter | Value | Description |
|-----------|-------|-------------|
| `worldIdRouter` | `0x469449f251692E0779667583026b5A1E99512157` | Sepolia World ID Router |
| `appId` | `app_crowdfundingds_staging` | Worldcoin app ID |
| `actionId` | `invest` | Worldcoin action ID |

> **Note**: All admin-configurable parameters can be adjusted via the **Admin Dashboard** or by calling the setter functions directly from the deployer wallet.

---

## Prerequisites

- **Node.js** 20+ and npm
- **Sepolia ETH** for gas (get from a Sepolia faucet)
- **Sepolia USDC** for testing (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`)
- **WalletConnect Project ID** (create at [cloud.walletconnect.com](https://cloud.walletconnect.com))
- **The Graph Studio account** (create at [thegraph.com/studio](https://thegraph.com/studio)) + deploy key

---

## Installation

### 1. Clone & Install

```bash
git clone https://github.com/NaolZebene/CrowdFundingDS.git
cd CrowdFundingDS

# Install all workspaces
npm install --workspaces
# or install each separately:
cd frontend && npm install
cd ../smartcontract && npm install
cd ../subgraph && npm install
```

### 2. Environment Setup

**Smart Contract** (`smartcontract/.env`):
```bash
cp smartcontract/.env.example smartcontract/.env
# Fill in:
# SEPOLIA_RPC_URL=<your_sepolia_rpc>
# PRIVATE_KEY=<your_deployer_private_key>
# TREASURY_ADDRESS=<optional_treasury_wallet>
# LENDER_ADDRESS=<optional_existing_lender_to_preserve>
```

**Frontend** (`frontend/.env`):
```bash
cp frontend/.env.example frontend/.env
# Fill in:
# VITE_WALLETCONNECT_PROJECT_ID=<your_project_id>
# VITE_SUBGRAPH_URL=<your_graphql_endpoint>
```

---

## Smart Contract Deployment

```bash
cd smartcontract

# Compile contracts
npm run compile:contracts

# Deploy to Sepolia (preserves existing lender if LENDER_ADDRESS is set)
npm run deploy:contract

# Check deployer USDC balance
npx hardhat run scripts/check-balances.ts --network sepolia

# Seed lender with yield (for testing)
FUND_LENDER_RESERVE_USDC=30 DRIP_LENDER_RESERVE=true npm run seed:yield
```

The deploy script auto-generates:
- `smartcontract/scripts/addresses.ts`
- `frontend/src/config/contracts.ts`
- `subgraph/subgraph.yaml`

---

## Subgraph Deployment

```bash
cd subgraph

# Generate TypeScript bindings from GraphQL schema
npm run codegen

# Build the subgraph
npm run build

# Authenticate with The Graph Studio
graph auth --studio <YOUR_DEPLOY_KEY>

# Deploy
npm run deploy:studio
```

After deployment, update `frontend/.env`:
```bash
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<your_id>/crowdvault/version/latest
```

---

## Frontend Development

```bash
cd frontend

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open `http://localhost:5173` and connect your wallet (Sepolia network).

---

## Deployed Contracts (Sepolia)

> **Latest deployment** — auto-generated by `deploy.ts`

| Contract | Address | Notes |
|----------|---------|-------|
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Sepolia USDC |
| CommitmentToken | `0xA4248774fBDeAa75A67F0E19265A99fEeC2a043a` | ERC-1155 project tokens |
| CrowdVault | `0xa95bf6334783F41dc3a7A7eB35AbF7d49eB68ADd` | Core crowdfunding logic |
| CommitmentAMM | `0x5932a623438d3E3701f90aA04A61A43230Ac71Ba` | Token trading pool |
| RevenueRouter | `0x2945839B84ffD52DA66256777BA6792AFfE89BbC` | Revenue distribution |
| MockLender | `0x6648fA6dCCD4fd68A4039C737B9c839543059B06` | Yield farming (preserved) |
| MockZKVerifier | `0xcE03E635604ACF23acB8C01553F2e3cE73775f2c` | KYC verification |
| WorldIDVerifierAdapter | `0x660d187ad69F51237F80785CC697e35699F1EfBB` | World ID proofs |

> **Note**: These addresses are written automatically to `frontend/src/config/contracts.ts` and `smartcontract/scripts/addresses.ts` after each deploy.

---

## Key Scripts Reference

### Smart Contract

| Script | Command | Purpose |
|--------|---------|---------|
| Compile | `npm run compile:contracts` | Compile all Solidity files |
| Deploy | `npm run deploy:contract` | Deploy full suite to Sepolia |
| Seed Yield | `npm run seed:yield` | Fund lender reserve & drip yield |
| Check Yield | `npx hardhat run scripts/check-yield.ts --network sepolia` | View yield status |
| Check Balances | `npx hardhat run scripts/check-balances.ts --network sepolia` | View token balances |
| Simulate Trades | `npx hardhat run scripts/simulate-amm-trades.ts --network sepolia` | Generate AMM swap activity |
| E2E Test | `npx hardhat run test/e2e.ts` | Full end-to-end test |

### Subgraph

| Script | Command | Purpose |
|--------|---------|---------|
| Codegen | `npm run codegen` | Generate TypeScript types |
| Build | `npm run build` | Compile subgraph to WASM |
| Deploy | `npm run deploy:studio` | Deploy to The Graph Studio |

### Frontend

| Script | Command | Purpose |
|--------|---------|---------|
| Dev | `npm run dev` | Start Vite dev server |
| Build | `npm run build` | Production build |
| Preview | `npm run preview` | Preview production build |

---

## Testing

### End-to-End Test

```bash
cd smartcontract
npx hardhat run test/e2e.ts
```

This runs a full cycle: create project → invest → verify milestones → request release → execute release → seed AMM → simulate trades.

### Manual Testing via Scripts

```bash
# Create a funded, closed project (for AMM testing)
npx hardhat run scripts/create-funded-closed-project.ts --network sepolia

# Create a veto-test project
npx hardhat run scripts/create-veto-test-project.ts --network sepolia

# Wire real modules (lender, oracle, ZK verifiers)
npx hardhat run scripts/wire-real-modules.ts --network sepolia

# Reseed AMM pools
npx hardhat run scripts/reseed-amm-pools.ts --network sepolia

# Claim yield as a backer
npx hardhat run scripts/test-claim-yield.ts --network sepolia

# Test timeout refund (dead project)
npx hardhat run scripts/test-timeout-refund.ts --network sepolia
```

---

## License

ISC
