import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { PROD_GUARDIAN_USBS } from "../../mainnet_constants";
const { ethers } = require("hardhat");

const deploy_usbsPricer: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("USBS_Pricer", {
    from: deployer,
    contract: "USBSPricer",
    args: [PROD_GUARDIAN_USBS, PROD_GUARDIAN_USBS],
    log: true,
  });
};

deploy_usbsPricer.tags = ["Prod-USBS-Pricer", "Prod-USBS-5"];
export default deploy_usbsPricer;
