pragma solidity 0.8.16;

import "forge-tests/USBS_BasicDeployment.sol";

contract USBSTest is USBS_BasicDeployment {
  function setUp() public override {
    super.setUp();
    _addAccountToAllowlistCurrentTerm(bob);
    vm.prank(guardian);
    usbs.mint(alice, 1000e18);
  }

  function test_usbs_name() public {
    assertEq(usbs.name(), "USBS");
  }

  function test_usbs_symbol() public {
    assertEq(usbs.symbol(), "USBS");
  }

  function test_usbs_decimals() public {
    assertEq(usbs.decimals(), 18);
  }

  function test_pause() public {
    vm.prank(guardian);
    usbs.pause();
    assertTrue(usbs.paused());
  }

  function test_mint_fail_when_paused() public pausedState {
    vm.expectRevert("ERC20Pausable: token transfer while paused");
    vm.prank(guardian);
    usbs.mint(bob, 10e18);
  }

  function test_burn_fail_when_paused() public pausedState {
    vm.startPrank(guardian);
    usbs.grantRole(usbs.BURNER_ROLE(), guardian);
    vm.expectRevert("ERC20Pausable: token transfer while paused");
    usbs.burn(alice, 10e18);
    vm.stopPrank();
  }

  function test_pause_fail_AC() public {
    vm.expectRevert("ERC20PresetMinterPauser: must have pauser role to pause");
    usbs.pause();
  }

  function test_unpause() public pausedState {
    vm.prank(guardian);
    usbs.unpause();
    assertFalse(usbs.paused());
  }

  function test_unpause_fail_AC() public {
    vm.prank(guardian);
    usbs.pause();
    vm.expectRevert(
      "ERC20PresetMinterPauser: must have pauser role to unpause"
    );
    usbs.unpause();
    assertTrue(usbs.paused());
  }

  function test_transfer_fail_paused() public pausedState {
    vm.expectRevert("ERC20Pausable: token transfer while paused");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_from_allowlist() public {
    _removeAccountFromAllowlistCurrentTerm(alice);

    vm.expectRevert("USBS: 'from' address not on allowlist");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_to_allowlist() public {
    _removeAccountFromAllowlistCurrentTerm(bob);

    vm.expectRevert("USBS: 'to' address not on allowlist");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_sender_allowlist() public {
    vm.prank(alice);
    usbs.approve(charlie, 1000e18);

    vm.expectRevert("USBS: 'sender' address not on allowlist");
    vm.prank(charlie);
    usbs.transferFrom(alice, bob, 1000e18);
  }

  function test_transfer_fail_from_blocklist() public {
    _addToBlocklist(alice);

    vm.expectRevert("USBS: 'from' address blocked");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_to_blocklist() public {
    _addToBlocklist(bob);

    vm.expectRevert("USBS: 'to' address blocked");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_sender_blocklist() public {
    _addToBlocklist(charlie);
    _addAccountToAllowlistCurrentTerm(charlie);

    vm.prank(alice);
    usbs.approve(charlie, 1000e18);
    vm.expectRevert("USBS: 'sender' address blocked");
    vm.prank(charlie);
    usbs.transferFrom(alice, bob, 1000e18);
  }

  function test_transfer_fail_from_sanctions() public {
    _addToSanctionsList(alice);

    vm.expectRevert("USBS: 'from' address sanctioned");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_to_sanctions() public {
    _addToSanctionsList(bob);

    vm.expectRevert("USBS: 'to' address sanctioned");
    vm.prank(alice);
    usbs.transfer(bob, 1000e18);
  }

  function test_transfer_fail_sender_sanctions() public {
    _addToSanctionsList(charlie);
    _addAccountToAllowlistCurrentTerm(charlie);

    vm.prank(alice);
    usbs.approve(charlie, 1000e18);
    vm.expectRevert("USBS: 'sender' address sanctioned");
    vm.prank(charlie);
    usbs.transferFrom(alice, bob, 1000e18);
  }

  function test_burn() public {
    uint256 totalSupply = usbs.totalSupply();
    vm.startPrank(guardian);
    usbs.grantRole(usbs.BURNER_ROLE(), guardian);
    usbs.burn(alice, 1000e18);
    vm.stopPrank();

    assertEq(usbs.totalSupply(), totalSupply - 1000e18);
    assertEq(usbs.balanceOf(alice), 0);
  }

  function test_burn_fail_AC() public {
    vm.expectRevert(_formatACRevert(charlie, usbs.BURNER_ROLE()));
    vm.prank(charlie);
    usbs.burn(alice, 1000e18);
  }

  function test_setSanctionsList_fail_AC() public {
    vm.expectRevert(_formatACRevert(bob, usbs.LIST_CONFIGURER_ROLE()));
    vm.prank(bob);
    usbs.setSanctionsList(charlie);
  }

  function test_setSanctionsList() public {
    ISanctionsList newSanctionsList = new MockSanctionsOracle();
    vm.startPrank(guardian);
    usbs.grantRole(usbs.LIST_CONFIGURER_ROLE(), guardian);
    vm.expectEmit(true, true, true, true);
    emit SanctionsListSet(address(sanctionsList), address(newSanctionsList));
    usbs.setSanctionsList(address(newSanctionsList));
    vm.stopPrank();
    assertEq(address(usbs.sanctionsList()), address(newSanctionsList));
  }

  function test_setBlocklist_fail_AC() public {
    vm.expectRevert(_formatACRevert(bob, usbs.LIST_CONFIGURER_ROLE()));
    vm.prank(bob);
    usbs.setBlocklist(charlie);
  }

  function test_setBlocklist() public {
    Blocklist newBlocklist = new Blocklist();
    vm.startPrank(guardian);
    usbs.grantRole(usbs.LIST_CONFIGURER_ROLE(), guardian);
    vm.expectEmit(true, true, true, true);
    emit BlocklistSet(address(blocklist), address(newBlocklist));
    usbs.setBlocklist(address(newBlocklist));
    vm.stopPrank();
    assertEq(address(usbs.blocklist()), address(newBlocklist));
  }

  function test_setAllowlist_fail_AC() public {
    vm.expectRevert(_formatACRevert(bob, usbs.LIST_CONFIGURER_ROLE()));
    vm.prank(bob);
    usbs.setAllowlist(charlie);
  }

  function test_setAllowlist() public {
    address oldAllowlist = address(usbs.allowlist());
    _deployAllowlist();
    vm.startPrank(guardian);
    usbs.grantRole(usbs.LIST_CONFIGURER_ROLE(), guardian);
    vm.expectEmit(true, true, true, true);
    emit AllowlistSet(oldAllowlist, address(allowlist));
    usbs.setAllowlist(address(allowlist));
    vm.stopPrank();
    assertEq(address(usbs.allowlist()), address(allowlist));
  }

  /*//////////////////////////////////////////////////////////////
                      Modifiers and Events
  //////////////////////////////////////////////////////////////*/

  modifier pausedState() {
    vm.prank(guardian);
    usbs.pause();
    _;
  }

  event SanctionsListSet(address oldSanctionsList, address newSanctionsList);
  event BlocklistSet(address oldBlocklist, address newBlocklist);
  event AllowlistSet(address oldAllowlist, address newAllowlist);
}
