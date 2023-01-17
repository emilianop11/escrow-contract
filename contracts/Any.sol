// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Any is ERC20 {
  constructor() ERC20('Any', 'Any token') {
    _mint(msg.sender, 50000);
  }
}