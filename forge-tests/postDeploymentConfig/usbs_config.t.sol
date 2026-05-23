pragma solidity 0.8.16;

import {PROD_CONSTANTS_USBS} from "forge-tests/postDeploymentConfig/prod_constants.t.sol";
import "forge-tests/USBS_BasicDeployment.sol";

contract ASSERT_FORK_USBS_PROD is PROD_CONSTANTS_USBS, USBS_BasicDeployment {
  /**
   * @notice INPUT ADDRESSES TO CHECK CONFIG OF BELOW
   *
   * USBS Deployment: 7/11/23
   * Passing on block: 17673284
   */
  address usbs_to_check = 0x96F6eF951840721AdBF46Ac996b59E0235CB985C;
  address usbsManager_to_check = 0x25A103A1D6AeC5967c1A4fe2039cdc514886b97e;

  bytes32 impl_slot =
    bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
  bytes32 admin_slot = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

  function setUp() public override {
    usbs = USBS(usbs_to_check);
    allowlist = AllowlistUpgradeable(address(usbs.allowlist()));
    blocklist = Blocklist(address(usbs.blocklist()));
    sanctionsList = ISanctionsList(usbs.sanctionsList());

    usbsManager = USBSManager(usbsManager_to_check);
    pricerUSBS = Pricer(address(usbsManager.pricer()));
  }

  function test_print_block() public view {
    console.log("The Current Block #: ", block.number);
  }

  function test_fork_assert_usbs_manager() public {
    /**
     * Check USBS Manager
     * 1) Assert Role member count
     * 2) Assert Role
     */
    assertEq(
      usbsManager.getRoleMemberCount(usbsManager.DEFAULT_ADMIN_ROLE()),
      1
    );
    assertEq(
      usbsManager.getRoleMember(usbsManager.DEFAULT_ADMIN_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbshub_default_admin
    );
    assertEq(usbsManager.getRoleMemberCount(usbsManager.MANAGER_ADMIN()), 1);
    assertEq(
      usbsManager.getRoleMember(usbsManager.MANAGER_ADMIN(), 0),
      PROD_CONSTANTS_USBS.usbshum_manager_admin
    );
    assertEq(usbsManager.getRoleMemberCount(usbsManager.PAUSER_ADMIN()), 1);
    assertEq(
      usbsManager.getRoleMember(usbsManager.PAUSER_ADMIN(), 0),
      PROD_CONSTANTS_USBS.usbshub_pauser_admin
    );

    assertEq(
      usbsManager.getRoleMemberCount(usbsManager.PRICE_ID_SETTER_ROLE()),
      1
    );
    assertEq(
      usbsManager.getRoleMember(usbsManager.PRICE_ID_SETTER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbshub_price_id_setter_role
    );

    assertEq(usbsManager.getRoleMemberCount(usbsManager.RELAYER_ROLE()), 1);
    assertEq(
      usbsManager.getRoleMember(usbsManager.RELAYER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbshub_relayer_role
    );
    // USBS specific role
    assertEq(
      usbsManager.getRoleMemberCount(usbsManager.TIMESTAMP_SETTER_ROLE()),
      1
    );
    assertEq(
      usbsManager.getRoleMember(usbsManager.TIMESTAMP_SETTER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbshub_timestamp_setter_role
    );

    // // ASSERT USBS Manager config
    assertEq(usbsManager.assetSender(), PROD_CONSTANTS_USBS.asset_sender);
    assertEq(usbsManager.assetRecipient(), PROD_CONSTANTS_USBS.asset_recipient);
    assertEq(usbsManager.feeRecipient(), PROD_CONSTANTS_USBS.fee_recipient);
    assertEq(address(usbsManager.rwa()), PROD_CONSTANTS_USBS.usbs_asset);
    assertEq(address(usbsManager.collateral()), PROD_CONSTANTS_USBS.collateral);
    assertEq(address(usbsManager.pricer()), PROD_CONSTANTS_USBS.usbs_pricer);
    assertEq(
      usbsManager.minimumDepositAmount(),
      PROD_CONSTANTS_USBS.min_deposit_amt
    );
    assertEq(
      usbsManager.minimumRedemptionAmount(),
      PROD_CONSTANTS_USBS.min_redeem_amt
    );
    assertEq(usbsManager.mintFee(), PROD_CONSTANTS_USBS.mint_fee);
    assertEq(usbsManager.redemptionFee(), PROD_CONSTANTS_USBS.redeem_fee);
    assertEq(
      usbsManager.BPS_DENOMINATOR(),
      PROD_CONSTANTS_USBS.bps_denominator
    );
    assertEq(address(usbsManager.blocklist()), PROD_CONSTANTS_USBS.block_list);
    assertEq(
      address(usbsManager.sanctionsList()),
      PROD_CONSTANTS_USBS.sanctions_list
    );
    assertEq(
      usbsManager.decimalsMultiplier(),
      PROD_CONSTANTS_USBS.decimals_multiplier
    );
  }

  function test_fork_assert_usbs_token_proxy() public {
    // Assert Proxy Setup
    bytes32 impl = vm.load(address(usbs), impl_slot);
    bytes32 admin = vm.load(address(usbs), admin_slot);
    assertEq(impl, PROD_CONSTANTS_USBS.usbs_impl_bytes);
    assertEq(admin, PROD_CONSTANTS_USBS.usbs_proxy_admin_bytes);

    // Assert that the owner of the proxy admin is correct
    assertEq(
      ProxyAdmin(address(uint160(uint256(admin)))).owner(),
      PROD_CONSTANTS_USBS.usbs_pa_owner
    );

    /**
     * Assert Token Roles
     * 1) Assert Role count
     * 2) Assert Role membership
     */
    assertEq(usbs.getRoleMemberCount(usbs.DEFAULT_ADMIN_ROLE()), 1);
    assertEq(
      usbs.getRoleMember(usbs.DEFAULT_ADMIN_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbs_default_admin
    );
    assertEq(usbs.getRoleMemberCount(usbs.MINTER_ROLE()), 1);
    assertEq(
      usbs.getRoleMember(usbs.MINTER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbs_minter_role
    );

    assertEq(usbs.getRoleMemberCount(usbs.PAUSER_ROLE()), 2);
    assertEq(
      usbs.getRoleMember(usbs.PAUSER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbs_default_admin
    );
    assertEq(
      usbs.getRoleMember(usbs.PAUSER_ROLE(), 1),
      PROD_CONSTANTS_USBS.usbs_pauser_role
    );

    /// @notice BURNER_ROLE - Not granted by default
    // assertEq(usbs.getRoleMemberCount(usbs.BURNER_ROLE()), 1);
    // assertEq(
    //   usbs.getRoleMember(usbs.BURNER_ROLE(), 0),
    //   PROD_CONSTANTS_USBS.usbs_pauser_role
    // );

    assertEq(usbs.getRoleMemberCount(usbs.LIST_CONFIGURER_ROLE()), 1);
    assertEq(
      usbs.getRoleMember(usbs.LIST_CONFIGURER_ROLE(), 0),
      PROD_CONSTANTS_USBS.usbs_list_config_role
    );

    // Assert Token config
    assertEq(address(usbs.allowlist()), PROD_CONSTANTS_USBS.usbs_allowlist);
    assertEq(address(usbs.blocklist()), PROD_CONSTANTS_USBS.usbs_blocklist);
    assertEq(
      address(usbs.sanctionsList()),
      PROD_CONSTANTS_USBS.usbs_sanctionslist
    );
    assertEq(usbs.paused(), PROD_CONSTANTS_USBS.paused);
    assertEq(usbs.decimals(), PROD_CONSTANTS_USBS.decimals);
    assertEq(usbs.name(), PROD_CONSTANTS_USBS.name);
    assertEq(usbs.symbol(), PROD_CONSTANTS_USBS.symbol);
  }

  function test_fork_assert_usbs_allowlist_proxy() public {
    // Assert Proxy setup
    bytes32 impl = vm.load(address(allowlist), impl_slot);
    bytes32 admin = vm.load(address(allowlist), admin_slot);
    assertEq(impl, PROD_CONSTANTS_USBS.allow_impl_bytes);
    assertEq(admin, PROD_CONSTANTS_USBS.allow_proxy_admin_bytes);

    // Assert that the owner of the proxy admin is correct
    assertEq(
      ProxyAdmin(address(uint160(uint256(admin)))).owner(),
      PROD_CONSTANTS_USBS.allow_pa_owner
    );

    /**
     * Assert Token Roles
     * 1) Assert Role count
     * 2) Assert Role membership
     */
    assertEq(allowlist.getRoleMemberCount(allowlist.DEFAULT_ADMIN_ROLE()), 1);
    assertEq(
      allowlist.getRoleMember(allowlist.DEFAULT_ADMIN_ROLE(), 0),
      PROD_CONSTANTS_USBS.allow_default_admin
    );
    assertEq(allowlist.getRoleMemberCount(allowlist.ALLOWLIST_ADMIN()), 1);
    assertEq(
      allowlist.getRoleMember(allowlist.ALLOWLIST_ADMIN(), 0),
      PROD_CONSTANTS_USBS.allow_allowlist_admin
    );
    assertEq(allowlist.getRoleMemberCount(allowlist.ALLOWLIST_SETTER()), 1);
    assertEq(
      allowlist.getRoleMember(allowlist.ALLOWLIST_SETTER(), 0),
      PROD_CONSTANTS_USBS.allow_allowlist_setter
    );
  }

  function test_fork_assert_blocklist() public {
    assertEq(blocklist.owner(), PROD_CONSTANTS_USBS.block_owner);
  }

  function test_fork_assert_pricer() public {
    assertEq(pricerUSBS.getRoleMemberCount(pricerUSBS.DEFAULT_ADMIN_ROLE()), 1);
    assertEq(
      pricerUSBS.getRoleMember(pricerUSBS.DEFAULT_ADMIN_ROLE(), 0),
      PROD_CONSTANTS_USBS.pricer_default_admin
    );
    assertEq(pricerUSBS.getRoleMemberCount(pricerUSBS.PRICE_UPDATE_ROLE()), 1);
    assertEq(
      pricerUSBS.getRoleMember(pricerUSBS.PRICE_UPDATE_ROLE(), 0),
      PROD_CONSTANTS_USBS.pricer_price_update_role
    );
  }
}
