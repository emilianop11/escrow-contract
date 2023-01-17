// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

contract Helper {
    address warrantyTokenAddress;
    address escrowContractOwner;

    constructor(address _tokenAddress) {
        warrantyTokenAddress = _tokenAddress;
        escrowContractOwner = msg.sender;
    }

    function transferFromTo(address _from, address _to, uint256 _amount) public {
        require(msg.sender == escrowContractOwner, "method can only be called by owner"); 
        ERC20(warrantyTokenAddress).transferFrom(_from, escrowContractOwner, _amount/100);
        ERC20(warrantyTokenAddress).transferFrom(_from, _to, _amount);
    }
}