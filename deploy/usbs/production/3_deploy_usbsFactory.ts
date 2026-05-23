import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { PROD_GUARDIAN_USBS } from "../../mainnet_constants";
const { ethers } = require("hardhat");

const deployUSBS_Factory: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  // Deploy the factory
  await deploy("USBSFactory", {
    from: deployer,
    args: [PROD_GUARDIAN_USBS],
    log: true,
  });
};

deployUSBS_Factory.tags = ["Prod-USBS-Factory", "Prod-USBS-3"];
export default deployUSBS_Factory;
