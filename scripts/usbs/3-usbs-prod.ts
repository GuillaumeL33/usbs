import { task } from "hardhat/config";
import {
  addContract,
  BaseProposalRequestParams,
  proposeFunctionCall,
} from "../utils/defender-helper";
import {
  PROD_GUARDIAN_USBS,
  SANCTION_ADDRESS,
} from "../../deploy/mainnet_constants";
import { SUCCESS_CHECK } from "../utils/shell";

task("3-usbs-prod", "Deploy USBS from factory contract").setAction(
  async ({}, hre) => {
    const name = "USBSFactory";
    let params: BaseProposalRequestParams = {
      via: PROD_GUARDIAN_USBS,
      viaType: "Gnosis Safe",
    };

    const usbsFactory = await hre.ethers.getContract(name);
    const blocklist = await hre.ethers.getContract("Blocklist");
    const allowlist = await hre.ethers.getContract("Allowlist");
    const network = await hre.run("getCurrentNetwork");
    const abi = await hre.run("getDeployedContractABI", { contract: name });

    let contract = {
      network: network,
      address: usbsFactory.address,
    };

    // Add USBS Factory contract to defender
    await addContract(network, usbsFactory.address, name, abi);
    console.log(SUCCESS_CHECK + "Added USBS Factory to Defender");

    // Propose the deployment in gnosis defender
    params.title = "Deploy USBS";
    params.description = "Deploy USBS token from factory";
    let listData = [blocklist.address, allowlist.address, SANCTION_ADDRESS];
    await proposeFunctionCall({
      contract: contract,
      params: params,
      functionName: "deployUSBS",
      functionInterface: [
        {
          name: "name",
          type: "string",
        },
        {
          name: "ticker",
          type: "string",
        },
        {
          components: [
            {
              name: "blocklist",
              type: "address",
            },
            {
              name: "allowlist",
              type: "address",
            },
            {
              name: "sanctionsList",
              type: "address",
            },
          ],
          name: "listData",
          type: "tuple",
        },
      ],
      functionInputs: ["US Dollar Bonds Short Token", "USBS", listData],
    });
    console.log(SUCCESS_CHECK + "Proposed USBS Deployment from factory");
  }
);
