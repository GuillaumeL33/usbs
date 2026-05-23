import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { KYC_REGISTRY, PROD_GUARDIAN_USBS } from "../../mainnet_constants";
const { ethers } = require("hardhat");

const deployAllowlist_Factory: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  // Deploy the factory
  await deploy("AllowlistFactory", {
    from: deployer,
    args: [PROD_GUARDIAN_USBS],
    log: true,
  });
};

deployAllowlist_Factory.tags = ["Prod-Allowlist-Factory", "Prod-USBS-1"];
export default deployAllowlist_Factory;
