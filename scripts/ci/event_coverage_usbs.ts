import { waitNSecondsUntilNodeUp } from "../utils/util";
import { keccak256, parseUnits } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";

import {
  getImpersonatedSigner,
  setUSDCBalance,
  increaseBlockTimestamp,
} from "../utils/util";

import { network, ethers } from "hardhat";
import { ERC20 } from "../../typechain";
import { BigNumber, Signer, providers } from "ethers";
import {
  KYC_REGISTRY,
  SANCTION_ADDRESS,
  USDC_MAINNET,
} from "../../deploy/mainnet_constants";

async function main() {
  const signers = await ethers.getSigners();

  const usdcWhaleSigner: SignerWithAddress = await getImpersonatedSigner(
    "0x79234Ca502Ed0BeDf575dDD504fDDD78d785A50D"
  );

  const guardian = signers[1];
  const managerAdmin = signers[2];
  const pauser = signers[3];
  const assetSender = signers[4];

  const user = signers[16];

  const usdc = await ethers.getContractAt("ERC20", USDC_MAINNET);
  const usbsManager = await ethers.getContract("USBSManager");
  const pricer = await ethers.getContract("USBS_Pricer");
  const allowlist = await ethers.getContract("Allowlist");
  const usbs = await ethers.getContract("USBS");
  const blocklist = await ethers.getContract("Blocklist");

  console.log(usdc.address);
  console.log(usbsManager.address);
  console.log(pricer.address);
  console.log(allowlist.address);
  console.log(usbs.address);
  let currentTerm = "Test Term 1";
  await allowlist.connect(guardian).addTerm("Test Term 1");
  await allowlist.connect(guardian).setValidTermIndexes([0]);

  // Add accounts to the allowlist
  // const currentTerm = await allowlist.currentTermIndex();
  let currentTermIndex = 0;
  await allowlist
    .connect(guardian)
    .setAccountStatus(user.address, currentTermIndex, true);
  await allowlist
    .connect(guardian)
    .setAccountStatus(guardian.address, currentTermIndex, true);
  await allowlist
    .connect(guardian)
    .setAccountStatus(usbsManager.address, currentTermIndex, true);

  await setUSDCBalance(user, usdcWhaleSigner, parseUnits("20000", 6));

  await usdc.connect(user).approve(usbsManager.address, parseUnits("20000", 6));
  const res = await allowlist.isAllowed(user.address);
  console.log(res);

  // console.log(usbsManager);
  await usbsManager.connect(user).requestSubscription(parseUnits("20000", 6));
  // get the priceId for the corresponding deposit
  const FIRST_DEPOSIT_ID = ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32);
  await usbsManager
    .connect(managerAdmin)
    .overwriteDepositor(
      FIRST_DEPOSIT_ID,
      user.address,
      parseUnits("10000", 6),
      BigNumber.from(0)
    );

  console.log((await pricer.getLatestPrice()).toString());
  await usbsManager
    .connect(managerAdmin)
    ["setPriceIdForDeposits(bytes32[],uint256[])"](
      [FIRST_DEPOSIT_ID],
      [BigNumber.from(1)]
    );

  let depositRequest = await usbsManager.depositIdToDepositor(FIRST_DEPOSIT_ID);
  // Assert check the data returned
  expect(depositRequest[0]).to.eq(user.address);
  expect(depositRequest[1]).to.eq(parseUnits("10000", 6));
  expect(depositRequest[2]).to.eq(BigNumber.from(1));

  const block = (await ethers.provider.getBlock()).timestamp;
  console.log(block);

  await usbsManager
    .connect(managerAdmin)
    .setClaimableTimestamp(block + 1, [FIRST_DEPOSIT_ID]);

  await network.provider.send("evm_increaseTime", [3600]);
  await usbsManager.connect(managerAdmin).claimMint([FIRST_DEPOSIT_ID]);
  const balClaimed = await usbs.balanceOf(user.address);
  console.log(balClaimed.toString());
  expect(balClaimed).eq(parseUnits("1000", 18));

  await pricer.connect(managerAdmin).addPrice(parseUnits("10", 18), 1);
  await pricer
    .connect(managerAdmin)
    .updatePrice(BigNumber.from(2), parseUnits("20", 18));

  await usbs.connect(user).approve(usbsManager.address, parseUnits("1000", 18));
  await usbsManager.connect(user).requestRedemption(parseUnits("500", 18));
  const HASH_OF_BANK = ethers.utils.hexZeroPad(ethers.utils.hexlify(69), 32);

  await usbsManager
    .connect(user)
    .requestRedemptionServicedOffchain(parseUnits("500", 18), HASH_OF_BANK);

  const balAfterRedemption = await usbs.balanceOf(user.address);
  // Assert that the user has no tokens remaining
  expect(balAfterRedemption).to.eq(BigNumber.from(0));

  // Set the priceId for the redemption
  await usbsManager
    .connect(managerAdmin)
    ["setPriceIdForRedemptions(bytes32[],uint256[])"](
      [FIRST_DEPOSIT_ID],
      [BigNumber.from(2)]
    );

  const redeemRequest = await usbsManager.redemptionIdToRedeemer(
    FIRST_DEPOSIT_ID
  );
  // Assert the redemption request for the user
  expect(redeemRequest[0]).to.eq(user.address);
  expect(redeemRequest[1]).to.eq(parseUnits("500", 18));
  expect(redeemRequest[2]).to.eq(BigNumber.from(2));

  await setUSDCBalance(assetSender, usdcWhaleSigner, parseUnits("20000", 6));
  await usdc
    .connect(assetSender)
    .approve(usbsManager.address, parseUnits("20000", 6));

  await usbsManager.connect(user).claimRedemption([FIRST_DEPOSIT_ID]);
  let balUSDC = await usdc.balanceOf(user.address);
  expect(balUSDC).to.eq(parseUnits("10000", 6));

  // Pause events
  await usbsManager.connect(pauser).pauseSubscription();
  await usbsManager.connect(pauser).pauseRedemption();

  // Unpause events
  await usbsManager.connect(managerAdmin).unpauseSubscription();
  await usbsManager.connect(managerAdmin).unpauseRedemption();

  // Set sanctions / Blocklist list event
  await usbsManager.connect(managerAdmin).setSanctionsList(SANCTION_ADDRESS);
  await usbsManager.connect(managerAdmin).setBlocklist(blocklist.address);

  // Pause off-chainRedemptions
  await usbsManager.connect(pauser).pauseOffChainRedemption();
  await usbsManager.connect(managerAdmin).unpauseOffChainRedemption();
}

main();
