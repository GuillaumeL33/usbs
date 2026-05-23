import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  PROD_ASSET_SENDER_USBS,
  PROD_FEE_RECIPIENT_USBS,
  PROD_MANAGER_ADMIN_USBS,
  PROD_PAUSER_USBS,
  SANCTION_ADDRESS,
  USDC_MAINNET,
  ZERO_ADDRESS,
} from "../../mainnet_constants";
import { parseUnits } from "ethers/lib/utils";
const { ethers } = require("hardhat");

const deploy_usbsManager: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const factoryUSBS = await ethers.getContract("USBSFactory");
  const factoryAllow = await ethers.getContract("AllowlistFactory");
  const blocklist = await ethers.getContract("Blocklist");

  const usbsAddress = await factoryUSBS.usbsProxy();
  const allowlistAddress = await factoryAllow.allowlistProxy();

  if (usbsAddress == ZERO_ADDRESS) {
    throw new Error("USBS Token not deployed through factory!");
  }

  await deploy("USBSManager", {
    from: deployer,
    args: [
      USDC_MAINNET, // _collateral
      usbsAddress, // _rwa
      PROD_MANAGER_ADMIN_USBS, // managerAdmin
      PROD_PAUSER_USBS, // pauser
      PROD_ASSET_SENDER_USBS, // _assetSender
      PROD_FEE_RECIPIENT_USBS, // _feeRecipient
      parseUnits("500", 6), // _minimumDepositAmount
      parseUnits("500", 18), // _minimumRedemptionAmount
      blocklist.address, // blocklist
      SANCTION_ADDRESS, // sanctionsList
    ],
    log: true,
  });
};
deploy_usbsManager.tags = ["Prod-USBSManager", "Prod-USBS-4"];
export default deploy_usbsManager;
