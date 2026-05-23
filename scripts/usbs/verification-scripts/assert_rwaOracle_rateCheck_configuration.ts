import { task } from "hardhat/config";
import {
  assertAgainstBlockchain,
  assertRoleMembers,
} from "../../utils/helpers";

import usbs_config from "./config";

task(
  "check-usbs-rwaOracle-rateCheck",
  "Checks if USBS RWAOracleRateCheck is configured correctly"
).setAction(async ({}, hre) => {
  console.log("hre.network.name ", hre.network.name);
  const config = usbs_config.rwaOracleRateCheck;
  const rwaOracleRateCheckAddress = config.rwaOracleRateCheckAddress;
  const rwaOracleRateCheckStorage = config.storage;
  const rwaOracleRateCheckContract = await hre.ethers.getContractAt(
    "RWAOracleRateCheck",
    rwaOracleRateCheckAddress
  );

  // Assert role members
  const roleMembers = rwaOracleRateCheckStorage.roleMembers;
  await assertRoleMembers(
    rwaOracleRateCheckContract,
    rwaOracleRateCheckStorage["DEFAULT_ADMIN_ROLE"],
    roleMembers.defaultAdminRoleMembers
  );
  await assertRoleMembers(
    rwaOracleRateCheckContract,
    rwaOracleRateCheckStorage["SETTER_ROLE"],
    roleMembers.setterRoleMembers
  );

  // Check data
  for (const name in rwaOracleRateCheckStorage.oracleData) {
    await assertAgainstBlockchain(
      rwaOracleRateCheckContract,
      name,
      rwaOracleRateCheckStorage.oracleData
    );
  }
});
