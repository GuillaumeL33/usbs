// SPDX-License-Identifier: BUSL-1.1
//
// BRIVO
pragma solidity 0.8.16;

import "contracts/interfaces/IPricer.sol";

interface IPricerWithOracle is IPricer {
  /**
   * @notice Updates a price in the pricer by pulling it from the oracle
   */
  function addLatestOraclePrice() external;
}
