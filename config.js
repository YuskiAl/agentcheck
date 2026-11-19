// AgentCheck configuration.
// Fill in CONTRACT_ADDRESS and DEPLOY_BLOCK after deployment, then the
// frontend works against the live contract. Until then the page shows a
// "not deployed yet" state and the leaderboard stays empty.
const CONFIG = {
  // BNB Chain mainnet
  CHAIN_ID: 56,
  CHAIN_NAME: "BNB Smart Chain",
  RPC_URL: "https://bsc-dataseed.binance.org/",
  EXPLORER: "https://bscscan.com",

  // Agent ID (SPACE ID) contract on BNB Chain mainnet — checksummed.
  AGENT_ID_ADDRESS: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F",
  AGENT_ID_ABI: ["function balanceOf(address owner) view returns (uint256)"],

  // Mainnet deployment, 19 Nov 2026. Creation tx
  // 0x1a7db67b216d4c398abc8888c9f5497aaeee187c4d32c94a842da27d9e8802f4.
  CONTRACT_ADDRESS: "0x69951ec1e92d9dC5C587cdD672006C04ef32e3D7",
  // First block to scan for CheckIn events (deployment block). 0 = genesis
  // (works, but scanning from genesis is slow — set the real block).
  DEPLOY_BLOCK: 134514748,

  // --- BSC TESTNET (chain 97) deployment, 19 Nov 2026 ---
  // MockAgentID + AgentCheckIn deployed from rigen (testnet only).
  // Mainnet CONTRACT_ADDRESS / DEPLOY_BLOCK above stay untouched until
  // the mainnet deploy (needs preview + user confirmation).
  TESTNET_CHAIN_ID: 97,
  TESTNET_RPC_URL: "https://bsc-testnet.publicnode.com",
  TESTNET_EXPLORER: "https://testnet.bscscan.com",
  TESTNET_MOCK_AGENT_ID_ADDRESS: "0x1E661bAb53a0a936f80Dc8F30C7e7BF033Ff9f21",
  TESTNET_CONTRACT_ADDRESS: "0x1aBa82ef4232552d0093098f6CA77384d9BB38c1",
  TESTNET_DEPLOY_BLOCK: 143489788,

  // Leaderboard settings.
  LEADERBOARD_TOP_N: 25,
  // eth_getLogs chunk size (BSC public RPCs reject very wide ranges).
  LOG_CHUNK_BLOCKS: 5000,
};
