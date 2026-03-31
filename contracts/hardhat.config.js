require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

// Enable TypeScript test files when running with a JS config
try {
  require("ts-node/register/transpile-only");
} catch (_) {}

const { subtask } = require("hardhat/config");
const {
  TASK_TEST_GET_TEST_FILES,
} = require("hardhat/builtin-tasks/task-names");
const path = require("path");
const glob = require("glob");

// Override the test file collection to include .ts files even with a JS config
subtask(TASK_TEST_GET_TEST_FILES).setAction(async ({ testFiles }, { config }) => {
  if (testFiles.length !== 0) {
    return testFiles.map((x) => path.resolve(process.cwd(), x));
  }
  const pattern = path.join(config.paths.tests, "**", "*.{js,ts}");
  return glob.sync(pattern).filter((f) => !f.endsWith(".d.ts"));
});

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    filecoinCalibnet: {
      url: "https://api.calibration.node.glif.io/rpc/v1",
      chainId: 314159,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    flowTestnet: {
      url: "https://testnet.evm.nodes.onflow.org",
      chainId: 545,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
