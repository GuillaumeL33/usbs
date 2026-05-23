import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  SANCTION_ADDRESS,
  USDC_MAINNET,
} from "../../mainnet_constants";
import { keccak256, parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";
const { ethers } = require("hardhat");

const deploy_usbsManager: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const signers = await ethers.getSigners();

  const guardian = signers[1];
  const managerAdmin = signers[2];
  const pauser = signers[3];
  const assetSender = signers[4];
  const feeRecipient = signers[5];
  const instantMintAdmin = signers[6];
  const relayer = signers[7];

  const usbs = await ethers.getContract("USBS");
  const blocklist = await ethers.getContract("Blocklist");

  await deploy("USBSManager", {
    from: deployer,
    args: [
      USDC_MAINNET,
      usbs.address,
      managerAdmin.address,
      pauser.address,
      assetSender.address,
      feeRecipient.address,
      parseUnits("1000", 6),
      parseUnits("10", 18),
      blocklist.address,
      SANCTION_ADDRESS,
    ],
    log: true,
  });

  const usbsManager = await ethers.getContract("USBSManager");
  const pricer = await ethers.getContract("USBS_Pricer");

  // Grant minting role to usbs manager
  await usbs
    .connect(guardian)
    .grantRole(
      keccak256(Buffer.from("MINTER_ROLE", "utf-8")),
      usbsManager.address
    );

  // Grant sub-roles to managerAdmin
  await usbsManager
    .connect(managerAdmin)
    .grantRole(
      keccak256(Buffer.from("PRICE_ID_SETTER_ROLE", "utf-8")),
      managerAdmin.address
    );
  await usbsManager
    .connect(managerAdmin)
    .grantRole(
      keccak256(Buffer.from("TIMESTAMP_SETTER_ROLE", "utf-8")),
      managerAdmin.address
    );
  await usbsManager
    .connect(managerAdmin)
    .grantRole(
      keccak256(Buffer.from("PAUSER_ADMIN", "utf-8")),
      managerAdmin.address
    );
  await usbsManager
    .connect(managerAdmin)
    .grantRole(
      keccak256(Buffer.from("RELAYER_ROLE", "utf-8")),
      relayer.address
    );
  await usbsManager.connect(managerAdmin).setPricer(pricer.address);
};

deploy_usbsManager.tags = ["Local", "usbsManager"];
deploy_usbsManager.dependencies = ["USBS"];
export default deploy_usbsManager;
