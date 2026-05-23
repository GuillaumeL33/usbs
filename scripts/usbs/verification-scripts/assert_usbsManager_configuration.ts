import {
  assertAgainstBlockchain,
  assertRoleMembers,
} from "../../utils/helpers";
import { task } from "hardhat/config";

import usbs_config from "./config";

task(
  "check-usbs-manager",
  "Checks if USBSManager has been properly initialized"
).setAction(async ({}, hre) => {
  console.log("hre.network.name ", hre.network.name);
  const ethers = hre.ethers;
  const jsonData = JSON.parse(JSON.stringify(usbs_config.usbsManager));
  const usbsManagerStorage = jsonData["storage"];

  const usbsManagerContract = await ethers.getContractAt(
    "USBSManager",
    jsonData.usbsManagerAddress
  );

  // Assert Role Members
  const usbsManagerRoleMembers = jsonData["usbsManagerRoleMembers"];
  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.DEFAULT_ADMIN_ROLE,
    usbsManagerRoleMembers.defaultAdminRoleMembers
  );

  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.MANAGER_ADMIN,
    usbsManagerRoleMembers.managerAdminRoleMembers
  );

  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.PAUSER_ADMIN,
    usbsManagerRoleMembers.pauserAdminRoleMembers
  );

  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.PRICE_ID_SETTER_ROLE,
    usbsManagerRoleMembers.priceIDSetterRoleMembers
  );

  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.RELAYER_ROLE,
    usbsManagerRoleMembers.relayerRoleMembers
  );

  await assertRoleMembers(
    usbsManagerContract,
    usbsManagerStorage.TIMESTAMP_SETTER_ROLE,
    usbsManagerRoleMembers.timestampSetterRoleMembers
  );

  // Assert the storage values for the contract
  for (const name in usbsManagerStorage) {
    await assertAgainstBlockchain(
      usbsManagerContract,
      name,
      usbsManagerStorage
    );
  }
});
