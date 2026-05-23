import { task, types } from "hardhat/config";
import { addContract } from "../utils/defender-helper";
import { SUCCESS_CHECK } from "../utils/shell";

task("4-save-usbs-prod", "Save USBS and Add to Defender").setAction(
  async ({}, hre) => {
    const { save } = hre.deployments;
    const usbsFactory = await hre.ethers.getContract("USBSFactory");
    const usbsProxy = await usbsFactory.usbsProxy();
    const usbsPa = await usbsFactory.usbsProxyAdmin();

    const usbsArtifact = await hre.deployments.getExtendedArtifact("USBS");
    const paAtrifact = await hre.deployments.getExtendedArtifact("ProxyAdmin");

    let usbsProxied = {
      address: usbsProxy,
      ...usbsArtifact,
    };
    let usbsAdmin = {
      address: usbsPa,
      ...paAtrifact,
    };

    await save("USBS", usbsProxied);
    await save("ProxyAdminUSBS", usbsAdmin);

    const abiUSBS = await hre.run("getDeployedContractABI", {
      contract: "USBS",
    });
    const abiPA = await hre.run("getDeployedContractABI", {
      contract: "ProxyAdminUSBS",
    });

    const network = await hre.run("getCurrentNetwork");

    await addContract(network, usbsProxy, "USBS Proxy", abiUSBS);
    console.log(SUCCESS_CHECK + "Added USBS Proxy to Defender");
    await addContract(network, usbsPa, "USBS Proxy Admin", abiPA);
    console.log(SUCCESS_CHECK + "Added USBS Proxy Admin to Defender");
  }
);
