import { task } from "hardhat/config";
import {
  addContract,
  BaseProposalRequestParams,
  proposeFunctionCall,
} from "../utils/defender-helper";
import { PROD_GUARDIAN_USBS } from "../../deploy/mainnet_constants";
import { SUCCESS_CHECK } from "../utils/shell";

task("1-usbs-prod", "Deploy Allowlist from factory contract").setAction(
  async ({}, hre) => {
    const name = "AllowlistFactory";
    let params: BaseProposalRequestParams = {
      via: PROD_GUARDIAN_USBS,
      viaType: "Gnosis Safe",
    };

    const usbsFactory = await hre.ethers.getContract(name);
    const network = await hre.run("getCurrentNetwork");
    const abi = await hre.run("getDeployedContractABI", { contract: name });

    let contract = {
      network: network,
      address: usbsFactory.address,
    };

    // Add USBS Factory contract to defender
    await addContract(network, usbsFactory.address, name, abi);
    console.log(SUCCESS_CHECK + "Added Allowlist Factory to Defender");

    // Propose the deployment in gnosis defender
    params.title = "Deploy Allowlist";
    params.description = "Deploy Allowlist from factory";
    await proposeFunctionCall({
      contract: contract,
      params: params,
      functionName: "deployAllowlist",
      functionInterface: [
        {
          name: "admin",
          type: "address",
        },
        {
          name: "setter",
          type: "address",
        },
      ],
      functionInputs: [PROD_GUARDIAN_USBS, PROD_GUARDIAN_USBS],
    });
    console.log(SUCCESS_CHECK + "Propose Allowlist deploy from factory");
  }
);
