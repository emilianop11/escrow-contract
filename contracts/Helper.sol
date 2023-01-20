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

    function transferFrom(address _from, address _to, uint256 _amount) public {
        require(msg.sender == escrowContractOwner, "method can only be called by owner");
        ERC20(warrantyTokenAddress).transferFrom(_from, _to, _amount);
    }

    function transferFromWithFee(address _from, address _to, uint256 _amount, uint256 _feeBase) public {
        require(msg.sender == escrowContractOwner, "method can only be called by owner");
        require(_feeBase > 0, "fee base cant be 0");
        require(ERC20(warrantyTokenAddress).balanceOf(_from) > (_amount + (_amount/_feeBase)), "Sender doesnt have sufficient funds");

        ERC20(warrantyTokenAddress).transferFrom(_from, escrowContractOwner, _amount/_feeBase);
        ERC20(warrantyTokenAddress).transferFrom(_from, _to, _amount);
    }

    function transferFromWithReferrer(address _from, address _to, uint256 _amount, uint256 _feeBase, address _referrer) public {
        require(msg.sender == escrowContractOwner, "method can only be called by owner");
        require(_feeBase > 0, "fee base cant be 0");
        require(ERC20(warrantyTokenAddress).balanceOf(_from) > (_amount + (_amount/_feeBase)), "Sender doesnt have sufficient funds");

        ERC20(warrantyTokenAddress).transferFrom(_from, _referrer, _amount/(2*_feeBase));
        ERC20(warrantyTokenAddress).transferFrom(_from, escrowContractOwner, _amount/(2*_feeBase));
        ERC20(warrantyTokenAddress).transferFrom(_from, _to, _amount);
    }
}