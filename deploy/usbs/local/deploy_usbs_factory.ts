import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { KYC_REGISTRY, SANCTION_ADDRESS } from "../../mainnet_constants";
const { ethers } = require("hardhat");

const deployAllowList_Factory: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { save } = deployments;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  const signers = await ethers.getSigners();

  const guardian = signers[1];

  await deploy("USBSFactory", {
    from: deployer,
    args: [guardian.address],
    log: true,
  });

  // USBS deps
  const factory = await ethers.getContract("USBSFactory");
  const blocklist = await ethers.getContract("Blocklist");
  const allowlist = await ethers.getContract("Allowlist");

  await factory
    .connect(guardian)
    .deployUSBS("USBS", "USBS", [
      blocklist.address,
      allowlist.address,
      SANCTION_ADDRESS,
    ]);

  const usbsProxy = await factory.usbsProxy();
  const usbsProxyAdmin = await factory.usbsProxyAdmin();
  const usbsImplementation = await factory.usbsImplementation();

  console.log(`\nThe USBS proxy is deployed @: ${usbsProxy}`);
  console.log(`The USBS proxy admin is deployed @: ${usbsProxyAdmin}`);
  console.log(`The USBS Implementation is deployed @: ${usbsImplementation}\n`);

  const usbsArtifact = await deployments.getExtendedArtifact("USBS");
  const paAtrifact = await deployments.getExtendedArtifact("ProxyAdmin");

  let usbsProxied = {
    address: usbsProxy,
    ...usbsArtifact,
  };
  let usbsAdmin = {
    address: usbsProxyAdmin,
    ...usbsProxyAdmin,
  };
  let usbsImpl = {
    address: usbsImplementation,
    ...usbsImplementation,
  };

  await save("USBS", usbsProxied);
  await save("ProxyAdminUSBS", usbsAdmin);
  await save("USBSImplementation", usbsImpl);
};

deployAllowList_Factory.tags = ["Local", "USBS"];
export default deployAllowList_Factory;
