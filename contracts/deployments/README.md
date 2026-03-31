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

Deployed: 2026-03-31
Deployer: `0xce4389ACb79463062c362fACB8CB04513fA3D8D8`

| Contract | Address |
|---|---|
| SampleToken | `0xb3Df63Ac5Ec5648d2E764a7C579148F29858E99D` |
| SampleNFT | `0x558298297E714312D5670dBe4dbc15E1D240a811` |
| TippingContract | `0x96A4978752D0fC8FccDe3c168A6a9E1c20B62330` |

Explorer: https://evm-testnet.flowscan.io/

---

## Phase 4 Integration Test Results

Executed: 2026-03-31

### Filecoin Calibnet — `onchain-identity.test.ts`

| Test | Result |
|---|---|
| Register new agent, verify Registered event and agentId > 0 | PASS |
| Retrieve tokenURI containing 'ipfs://' | PASS |
| Update agent URI via setAgentURI, verify tokenURI changes | PASS |
| Set and get metadata (ethers.toUtf8Bytes / ethers.toUtf8String) | PASS |
| Give feedback to Eric (agentId=1), verify getFeedback index 0 | PASS |
| Retrieve all 4 agents by name, verify isVantageAgent=true | PASS |
| Verify Eric's role is 'market_analyst' | PASS |

**7 / 7 passed**

Notes:
- Eric's ERC-721 owner is the VantageAgentRegistry contract (not the deployer directly), so deployer can give feedback to Eric without triggering self-feedback revert.
- Registered test agents received IDs 5, 6, 7 (IDs 1–4 are Eric, Harper, Rishi, Yasmin).

### Flow EVM Testnet — `onchain-flow.test.ts`

| Test | Result |
|---|---|
| Verify SampleToken name='Vantage Token', symbol='VTG' | PASS |
| Mint 100 tokens to deployer, verify balance increased | PASS |
| Transfer 10 tokens to random address, verify balance decreased | PASS |
| Mint NFT with tokenURI, verify receipt.status=1 and tokenURI | PASS |
| Send 0.001 FLOW tip to deployer (self-tip), verify tipsFor increases | PASS |
| Withdraw tips, verify receipt.status=1 and balance zeroed | PASS |

**6 / 6 passed**

### Filecoin Calibnet — `cross-chain.test.ts`

| Test | Result |
|---|---|
| Harper agentId > 0 and isVantageAgent=true | PASS |
| Rishi's model is 'claude-3.5-sonnet' | PASS |
| Cross-chain verification log message | PASS |

**3 / 3 passed**

### Gas Analysis (Filecoin Calibnet)

| Operation | Gas Estimate |
|---|---|
| Register Agent (`IdentityRegistry.register`) | 17,046,431 |
