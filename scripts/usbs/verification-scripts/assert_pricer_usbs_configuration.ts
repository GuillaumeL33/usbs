import { task } from "hardhat/config";
import {
  assertAgainstBlockchain,
  assertRoleMembers,
} from "../../utils/helpers";

import usbs_config from "./config";

task(
  "check-usbs-pricer",
  "Checks if USBS pricer is configured correctly"
).setAction(async ({}, hre) => {
  console.log("hre.network.name ", hre.network.name);
  const jsonData = JSON.parse(JSON.stringify(usbs_config.usbs_pricer));
  const usbsPricerStorage = jsonData["storage"];
  const usbsPricerContract = await hre.ethers.getContractAt(
    "Pricer",
    jsonData.usbsPricerAddress
  );

  // Assert role members
  const usbsPricerRoleMembers = jsonData["usbsPricerRoleMembers"];
  await assertRoleMembers(
    usbsPricerContract,
    usbsPricerStorage.DEFAULT_ADMIN_ROLE,
    usbsPricerRoleMembers.defaultAdminRoleMembers
  );
  await assertRoleMembers(
    usbsPricerContract,
    usbsPricerStorage.PRICE_UPDATE_ROLE,
    usbsPricerRoleMembers.priceUpdateRoleMembers
  );

  // Check data
  for (const name in usbsPricerStorage) {
    await assertAgainstBlockchain(usbsPricerContract, name, usbsPricerStorage);
  }
});
