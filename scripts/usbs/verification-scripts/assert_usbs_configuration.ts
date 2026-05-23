import { assert } from "console";
import {
  ADMIN_SLOT,
  ROLLBACK_SLOT,
  IMPLEMENTATION_SLOT,
  BEACON_SLOT,
} from "../../utils/constants";
import {
  assertAgainstBlockchain,
  assertRoleMembers,
  addressFromStorageSlot,
} from "../../utils/helpers";
import usbs_config from "./config";
import { task } from "hardhat/config";
import { FAILURE_CROSS } from "../../utils/shell";

task(
  "check-usbs",
  "Checks if USBS contract has been properly initialized"
).setAction(async ({}, hre) => {
  console.log("hre.network.name ", hre.network.name);
  const ethers = hre.ethers;
  const jsonData = JSON.parse(JSON.stringify(usbs_config.usbs));
  const usbsProxyData = jsonData["usbsProxy"];

  // Assert Proxy Admin slots
  assert(
    (await addressFromStorageSlot(jsonData["usbsProxyAddress"], ADMIN_SLOT)) ==
      usbsProxyData.proxyAdmin,
    FAILURE_CROSS + "proxy admin mismatch"
  );

  assert(
    (await addressFromStorageSlot(
      jsonData["usbsProxyAddress"],
      ROLLBACK_SLOT
    )) == usbsProxyData.rollback,
    FAILURE_CROSS + "proxy rollback mismatch"
  );

  assert(
    (await addressFromStorageSlot(jsonData["usbsProxyAddress"], BEACON_SLOT)) ==
      usbsProxyData.beacon,
    FAILURE_CROSS + "proxy beacon mismatch"
  );

  assert(
    (await addressFromStorageSlot(
      jsonData["usbsProxyAddress"],
      IMPLEMENTATION_SLOT
    )) == usbsProxyData.implementation,
    FAILURE_CROSS + "proxy impl mismatch"
  );

  // Assert USBS Proxy Admin
  const usbsProxyAdminContract = await ethers.getContractAt(
    "ProxyAdmin",
    usbsProxyData.proxyAdmin
  );

  assert(
    (await usbsProxyAdminContract.getProxyAdmin(jsonData.usbsProxyAddress)) ==
      usbsProxyAdminContract.address,
    "getProxyAdmin failed on the proxy admin contract"
  );

  assert(
    (await usbsProxyAdminContract.getProxyImplementation(
      jsonData.usbsProxyAddress
    )) == usbsProxyData.implementation,
    "getProxyImplementation failed on the proxy admin contract"
  );

  assert(
    (await usbsProxyAdminContract.owner()) == jsonData["usbsProxyAdmin"].owner,
    "Proxy admin owner check failed on the proxy admin contract"
  );

  const usbsProxyContract = await ethers.getContractAt(
    "USBS",
    jsonData.usbsProxyAddress
  );

  // Assert Role Members
  const usbsRoleMembers = jsonData["usbsProxyRoleMembers"];
  await assertRoleMembers(
    usbsProxyContract,
    usbsProxyData.DEFAULT_ADMIN_ROLE,
    usbsRoleMembers.defaultAdminRoleMembers
  );

  await assertRoleMembers(
    usbsProxyContract,
    usbsProxyData.BURNER_ROLE,
    usbsRoleMembers.burnerRoleMembers
  );

  await assertRoleMembers(
    usbsProxyContract,
    usbsProxyData.LIST_CONFIGURER_ROLE,
    usbsRoleMembers.listConfigurerRoleMembers
  );

  await assertRoleMembers(
    usbsProxyContract,
    usbsProxyData.MINTER_ROLE,
    usbsRoleMembers.minterRoleMembers
  );

  await assertRoleMembers(
    usbsProxyContract,
    usbsProxyData.PAUSER_ROLE,
    usbsRoleMembers.pauserRoleMembers
  );

  // Assert the storage values for the proxy contract that pertain to
  // implementation contract
  for (const name in usbsProxyData.implementationStorage) {
    await assertAgainstBlockchain(
      usbsProxyContract,
      name,
      usbsProxyData.implementationStorage
    );
  }
});
