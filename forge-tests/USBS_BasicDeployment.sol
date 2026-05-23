pragma solidity 0.8.16;

import "forge-tests/BaseTestRunner.sol";
import "contracts/usbs/allowlist/AllowlistFactory.sol";
import "forge-tests/helpers/events/USBSManagerEvents.sol";
import "contracts/external/openzeppelin/contracts/proxy/ProxyAdmin.sol";
import "contracts/usbs/USBSManager.sol";
import "contracts/usbs/USBS.sol";
import "contracts/usbs/USBSFactory.sol";
import "contracts/Pricer.sol";
import "contracts/usbs/allowlist/AllowlistUpgradeable.sol";
import "contracts/usbs/blocklist/Blocklist.sol";
import "contracts/Proxy.sol";
import "forge-tests/usbs/allowlist/AllowlistUpgradeable_BasicDeployment.sol";
import "contracts/external/chainalysis/ISanctionsList.sol";
import "forge-tests/helpers/MockSanctionsOracle.sol";

abstract contract USBS_BasicDeployment is
  BaseTestRunner,
  AllowlistUpgradeable_BasicDeployment,
  USBSManagerEvents
{
  Blocklist blocklist;
  ISanctionsList sanctionsList;
  // USBS Contract Array
  USBS usbs; // Proxy with abi of implementation
  TokenProxy usbsProxy;
  ProxyAdmin usbsProxyAdmin;
  USBS usbsImplementation;
  USBSFactory usbsFactory;

  // USBS Manager Contracts
  USBSManager usbsManager;
  Pricer pricerUSBS;
  DeltaCheckHarness oracleCheckHarnessUSBS;

  address[] public accountsTmp;

  function setUp() public virtual override {
    // Heavily order dependent call flow
    _deployAllowlist();
    _deployBlocklist();
    _deploySanctionsList();
    _deployUSBS();
    _deployUSBSPricer();
    _deployUSBSManager();
    _postDeployActions();
  }

  function _deployBlocklist() internal {
    blocklist = new Blocklist();
  }

  function _deploySanctionsList() internal {
    sanctionsList = new MockSanctionsOracle();
  }

  function _deployUSBS() internal {
    usbsFactory = new USBSFactory(guardian);
    USBSFactory.USBSListData memory usbsListData;
    usbsListData.allowlist = address(allowlist);
    usbsListData.blocklist = address(blocklist);
    usbsListData.sanctionsList = address(sanctionsList);

    vm.prank(guardian);
    (address proxy, address proxyAdmin, address implementation) = usbsFactory
      .deployUSBS("USBS", "USBS", usbsListData);

    usbs = USBS(proxy);
    usbsProxy = TokenProxy(payable(proxy));
    usbsProxyAdmin = ProxyAdmin(proxyAdmin);
    usbsImplementation = USBS(implementation);
    vm.prank(guardian);
    usbs.grantRole(keccak256("MINTER_ROLE"), guardian);
  }

  function _deployUSBSPricer() internal {
    oracleCheckHarnessUSBS = new DeltaCheckHarness();
    oracleCheckHarnessUSBS.setPrice(1e18);
    pricerUSBS = new Pricer(
      guardian, // Admin
      address(this) // Price Update operator
    );
    // Add a price
    pricerUSBS.addPrice(1e18, block.timestamp);
  }

  function _deployUSBSManager() internal virtual {
    usbsManager = new USBSManager(
      address(USDC),
      address(usbs),
      managerAdmin,
      pauser,
      assetSender,
      feeRecipient,
      100e6, // minimum deposit amount
      100e18, // minimum redemption amount
      address(blocklist),
      address(sanctionsList)
    );
    vm.startPrank(guardian);
    usbs.grantRole(usbs.MINTER_ROLE(), address(usbsManager));
    vm.stopPrank();

    vm.startPrank(managerAdmin);
    usbsManager.grantRole(usbsManager.PRICE_ID_SETTER_ROLE(), managerAdmin);
    usbsManager.grantRole(usbsManager.TIMESTAMP_SETTER_ROLE(), managerAdmin);
    usbsManager.grantRole(usbsManager.PAUSER_ADMIN(), managerAdmin);

    usbsManager.setPricer(address(pricerUSBS));
    usbsManager.grantRole(usbsManager.RELAYER_ROLE(), relayer);
    vm.stopPrank();
  }

  function _postDeployActions() internal {
    // Set general variables for rwa tests
    _setRwaHub(address(usbsManager));
    _setRwa(address(usbs));
    _setPricer(address(pricerUSBS));
    _setOracleCheckHarness(address(oracleCheckHarnessUSBS));

    // Allowlist
    _addAccountToAllowlistCurrentTerm(guardian);
    _addAccountToAllowlistCurrentTerm(alice);
    _addAccountToAllowlistCurrentTerm(address(rwaHub));

    // Labels
    vm.label(guardian, "guardian");
    vm.label(address(USDC), "USDC");
  }

  /*//////////////////////////////////////////////////////////////
                             Utils
  //////////////////////////////////////////////////////////////*/

  function _addToBlocklist(address user) internal {
    accountsTmp.push(user);
    blocklist.addToBlocklist(accountsTmp);
  }

  function _addToSanctionsList(address user) internal {
    MockSanctionsOracle(address(sanctionsList)).addAddress(user);
  }

  function _initializeUSBSUsersArray() internal {
    for (uint256 i = 0; i < 300; i++) {
      address user = address(new User());
      users.push(user);
      _addAccountToAllowlistCurrentTerm(user);
    }
  }
}
