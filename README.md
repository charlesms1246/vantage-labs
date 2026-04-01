<p align="center">
  <img src="frontend/public/vantage_logo_transparent.png" alt="Vantage Labs Logo" width="400"/>
</p>

<p align="center">
  <strong>Decentralized Autonomous Agency powered by AI Agents on Flow EVM & Filecoin</strong>
</p>

---

## Overview

Vantage Labs is a Decentralized Autonomous Agency (DAA) — a multi-agent AI system where four specialized agents collaborate to help users navigate the Web3 ecosystem. Built on **Flow EVM** for proof-of-execution and **Filecoin** for identity and permanent storage, every agent action is verifiable on-chain.

### Key Features

- **AI Agent Swarm**: Four specialized agents (Eric, Harper, Rishi, Yasmin) coordinated by an Orchestrator
- **Dual-Chain Architecture**: Flow EVM for proof NFTs, Filecoin for agent identity and reputation
- **Human-in-the-Loop**: All on-chain actions require user approval before execution
- **Verifiable Actions**: Every session log is uploaded to Filecoin via Lighthouse and linked to an NFT
- **Terminal Interface**: Retro-style terminal UI for interacting with the agent swarm
- **Multi-LLM Backend**: Groq, Gemini, and OpenRouter power different agents for specialized performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│               (Next.js 16 + Privy Wallet)                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
│          (Node.js + Express + LangChain.js)                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Orchestrator (Groq / Llama-3.3)            │   │
│  │                                                      │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │   │
│  │  │ Eric │  │Harper│  │Rishi │  │Yasmin│            │   │
│  │  │OpenR.│  │OpenR.│  │OpenR.│  │ Groq │            │   │
│  │  └──────┘  └──────┘  └──────┘  └──────┘            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                              │
    ┌─────┴──────┐              ┌────────┴───────┐
    ▼            ▼              ▼                ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐
│ Flow EVM │  │Lighthouse│  │  Filecoin    │  │      IPFS          │
│ Testnet  │  │  (IPFS)  │  │  Calibnet   │  │  (Session Logs)    │
│          │  │          │  │             │  │                    │
│ • Proof  │  │ • Upload │  │ • Identity  │  │ • Proofs           │
│   NFTs   │  │   Logs   │  │   Registry  │  │ • Metadata         │
│ • Tokens │  │          │  │ • Reputation│  │                    │
└──────────┘  └──────────┘  └─────────────┘  └────────────────────┘
```

## Meet the Agents

### Eric - Market Analyst
- **Specialty**: Market research, price analysis, yield opportunities, on-chain analytics
- **Model**: OpenRouter (MiniMax M2.5)
- **Tools**: `analyze_market`, `store_analysis`, `get_yield_opportunities`

### Harper - Trader
- **Specialty**: Trade execution, portfolio management, DeFi interactions
- **Model**: OpenRouter (Step-3.5 Flash)
- **Tools**: `verify_agent_identity`, `prepare_transaction`, `execute_swap`

### Rishi - Developer
- **Specialty**: Smart contract generation, code debugging, contract deployment
- **Model**: OpenRouter (Nemotron / Qwen)
- **Tools**: `generate_contract`, `deploy_contract`, `store_proof`

### Yasmin - Creative
- **Specialty**: NFT art generation, content creation, marketing
- **Model**: Groq (Qwen3-32B) + Gemini 2.5 Flash (image generation)
- **Tools**: `generate_image`, `create_nft_metadata`, `upload_to_filecoin`, `create_tweet`

### Orchestrator
- **Role**: Parses user intent, creates execution plans, routes tasks to agents
- **Model**: Groq (Llama-3.3-70B Versatile)

## Agent Identity & Reputation

Every agent has a verifiable on-chain identity and reputation score, stored across two Filecoin Calibnet contracts.

### On-Chain Identity

Each agent is registered with a unique **ERC-8004 identity** in the `IdentityRegistry` contract on Filecoin Calibnet, giving them a verifiable on-chain identity. The identity's `tokenURI` points to an IPFS-hosted metadata JSON (via Lighthouse) containing the agent's name, role, and model.

| Agent | Token ID | Role | On-Chain ID |
|-------|----------|------|-------------|
| Eric | 1 | market_analyst | Filecoin Calibnet |
| Harper | 2 | trader | Filecoin Calibnet |
| Rishi | 3 | developer | Filecoin Calibnet |
| Yasmin | 4 | creative | Filecoin Calibnet |

The `VantageAgentRegistry` contract maps agent names to their token IDs and stores additional metadata (model used, agent URI), making it easy to look up agents by name on-chain.

### Reputation System

Agent reputation is tracked in the `ReputationRegistry` contract. Scores start at **5000** and change based on outcomes:

| Event | Score Change |
|-------|-------------|
| Successful action | +100 |
| Failed action | -50 |
| Endorsement from another agent | +200 |

Reputation scores are publicly readable on-chain and can be queried via the `GET /api/agents/:name/status` endpoint.

### Proof of Execution

After every session completes:
1. The full session log is uploaded to Filecoin via **Lighthouse** → returns a CID
2. An **ERC-721 proof NFT** is minted on Flow EVM Testnet with `tokenURI` pointing to the session log CID
3. The `txHash`, `tokenId`, and a block explorer link are returned to the user

This creates an immutable, publicly verifiable record of every agent action.

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/charlesms1246/vantage-labs.git
cd vantage-labs

# Install dependencies
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# For frontend, create .env.local
cp frontend/.env.local.example frontend/.env.local 2>/dev/null || \
  echo "NEXT_PUBLIC_PRIVY_APP_ID=your_app_id
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001" > frontend/.env.local
```

### Running Locally

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000` to use the application.

## Environment Variables

### Backend (`backend/.env`)

```bash
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# AI APIs
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Filecoin Calibnet (Chain ID: 314159)
FILECOIN_RPC=https://api.calibration.node.glif.io/rpc/v1
IDENTITY_REGISTRY_ADDRESS=0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D
REPUTATION_REGISTRY_ADDRESS=0x558298297E714312D5670dBe4dbc15E1D240a811
VANTAGE_REGISTRY_ADDRESS=0x7Bbfb48BCEDF4B562fAB3cFdcb5974bf7cACd290

# Flow EVM Testnet (Chain ID: 545)
FLOW_RPC=https://testnet.evm.nodes.onflow.org
SAMPLE_TOKEN_ADDRESS=0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D
SAMPLE_NFT_ADDRESS=0x558298297E714312D5670dBe4dbc15E1D240a811
TIPPING_CONTRACT_ADDRESS=0x96A4978752D0fC8FccDe3c168A6a9E1c20B62330

# Lighthouse (Filecoin Storage)
LIGHTHOUSE_API_KEY=your_lighthouse_api_key

# Blockchain deployer wallet
DEPLOYER_PRIVATE_KEY=your_private_key
```

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing

```bash
# Backend unit tests
cd backend && npm test

# Backend integration tests
cd backend && npm run test:integration

# Frontend E2E tests (Playwright)
cd frontend && npm run test:e2e

# Frontend E2E with UI
cd frontend && npm run test:e2e:ui
```

## Project Structure

```
vantage-labs/
├── contracts/                  # Solidity smart contracts (Hardhat)
│   ├── src/                    # Contract source files
│   ├── test/                   # Contract tests
│   ├── scripts/                # Deployment scripts
│   └── deployments/            # Deployment records
├── backend/                    # Node.js backend
│   └── src/
│       ├── agents/             # LangChain agent implementations
│       ├── services/           # Blockchain & storage services
│       ├── routes/             # Express REST routes
│       ├── websocket/          # Socket.io handlers
│       ├── tools/              # LangChain tools per agent
│       └── config/             # Environment & chain configuration
├── frontend/                   # Next.js 16 frontend
│   └── src/
│       ├── app/                # Next.js App Router pages
│       ├── components/         # React components
│       ├── contexts/           # React context providers
│       ├── hooks/              # Custom hooks (WebSocket, etc.)
│       └── lib/                # API client, socket manager
└── docs/                       # Documentation
```

## Deployed Contracts

### Filecoin Calibnet (Chain ID: 314159)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D` |
| ReputationRegistry | `0x558298297E714312D5670dBe4dbc15E1D240a811` |
| VantageAgentRegistry | `0x7Bbfb48BCEDF4B562fAB3cFdcb5974bf7cACd290` |

### Flow EVM Testnet (Chain ID: 545)

| Contract | Address |
|----------|---------|
| SampleToken (VTG) | `0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D` |
| SampleNFT | `0x558298297E714312D5670dBe4dbc15E1D240a811` |
| TippingContract | `0x96A4978752D0fC8FccDe3c168A6a9E1c20B62330` |


## Acknowledgments

- [Flow Blockchain](https://flow.com) for EVM compatibility and fast finality
- [Filecoin](https://filecoin.io) for decentralized identity and storage
- [Lighthouse](https://lighthouse.storage) for IPFS storage SDK
- [LangChain](https://langchain.com) for the agent framework
- [Privy](https://privy.io) for wallet authentication
- [Groq](https://groq.com), [Google Gemini](https://deepmind.google/technologies/gemini/), [OpenRouter](https://openrouter.ai) for LLM inference

## License

This project is licensed under the MIT License.

---