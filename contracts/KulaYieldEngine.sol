// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Base Sepolia USDC
  const USDC   = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  // Base Sepolia Aave V3 Pool
  const AAVE   = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b";
  // Your AI oracle backend wallet address
  const ORACLE = process.env.ORACLE_WALLET;

  // 1. KulaYieldEngine
  const YieldEngine = await hre.ethers.getContractFactory("KulaYieldEngine");
  const yieldEngine = await YieldEngine.deploy(USDC, AAVE);
  await yieldEngine.waitForDeployment();
  console.log("KulaYieldEngine:", await yieldEngine.getAddress());

  // 2. KulaPublicRegistry
  const Registry = await hre.ethers.getContractFactory("KulaPublicRegistry");
  const registry = await Registry.deploy(ORACLE);
  await registry.waitForDeployment();
  console.log("KulaPublicRegistry:", await registry.getAddress());

  // 3. KulaGovernance
  const Governance = await hre.ethers.getContractFactory("KulaGovernance");
  const governance = await Governance.deploy(USDC);
  await governance.waitForDeployment();
  console.log("KulaGovernance:", await governance.getAddress());

  // 4. RotaryGroup (needs all three above)
  const RotaryGroup = await hre.ethers.getContractFactory("RotaryGroup");
  const rotaryGroup = await RotaryGroup.deploy(
    USDC,
    await registry.getAddress(),
    await yieldEngine.getAddress(),
    await governance.getAddress()
  );
  await rotaryGroup.waitForDeployment();
  console.log("RotaryGroup:", await rotaryGroup.getAddress());

  // 5. Wire contracts together
  console.log("Wiring contracts...");
  await governance.setRotaryGroup(await rotaryGroup.getAddress());
  await yieldEngine.setRotaryGroup(await rotaryGroup.getAddress());

  console.log("✅ All contracts deployed and wired.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
