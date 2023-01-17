// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Wbtc is ERC20 {
  constructor() ERC20('Wbtc', 'Wrapped bitcoin') {
    _mint(msg.sender, 5000);
  }
}