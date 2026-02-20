const hre = require("hardhat");

async function main() {
  console.log("Deploying KULA RotaryGroup...");

  // Base Sepolia Testnet USDC Address (Mock)
  const MOCK_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const RotaryGroup = await hre.ethers.getContractFactory("RotaryGroup");
  const rotaryGroup = await RotaryGroup.deploy(MOCK_USDC);

  await rotaryGroup.waitForDeployment();

  console.log(`KULA RotaryGroup deployed to: ${await rotaryGroup.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

