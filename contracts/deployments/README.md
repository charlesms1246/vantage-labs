# Vantage Labs — Testnet Deployments

## Filecoin Calibnet (Chain ID: 314159)

Deployed: 2026-03-31T02:43:00.925Z
Deployer: `0xce4389ACb79463062c362fACB8CB04513fA3D8D8`

| Contract | Address |
|---|---|
| IdentityRegistry | `0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D` |
| ReputationRegistry | `0x558298297E714312D5670dBe4dbc15E1D240a811` |
| VantageAgentRegistry | `0x7Bbfb48BCEDF4B562fAB3cFdcb5974bf7cACd290` |

Explorer: https://calibration.filfox.info/

### Registered Agents

| Name | Role | Model | Agent ID |
|---|---|---|---|
| Eric | market_analyst | gemini | 1 |
| Harper | trader | groq-llama | 2 |
| Rishi | developer | claude-3.5-sonnet | 3 |
| Yasmin | creative | gemini | 4 |

---

## Flow EVM Testnet (Chain ID: 545)

**Status: Pending — wallet has no testnet FLOW balance.**

Fund the deployer address at: https://faucet.flow.com/fund-account
Deployer address: `0xce4389ACb79463062c362fACB8CB04513fA3D8D8`

After funding, run:
```bash
npx hardhat run scripts/deploy/deploy-flow.ts --network flowTestnet
```

Explorer: https://evm-testnet.flowscan.io/
