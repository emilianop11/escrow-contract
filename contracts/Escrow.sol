// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

contract Escrow {
  struct ContractParty {
    address partyAddress;
    uint256 _lockedAmount;
    bool approvedRelease;
    uint256 _withdrawnAmount;
  }

  struct Contract{
      uint256 _contractId;
      address createdBy;
      uint unlockTime;
      uint256 numberOfParties;
      ContractParty[] involvedParties;
  }

  using Counters for Counters.Counter;
  address warrantyTokenAddress;
  Counters.Counter private _contractIdCounter;
  address escrowContractOwner;
  mapping(uint256 => Contract) _contracts;
  mapping(address => uint256[]) _addressesToContract;

  constructor(address _tokenAddress) {
    warrantyTokenAddress = _tokenAddress;
    escrowContractOwner = msg.sender;
  }

  function isContractRedeemable(uint256 contractId) public view returns(bool) {
    if (!isContractCompletelySigned(contractId)) return true;

    Contract memory cont = getContract(contractId);

    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (!cont.involvedParties[i].approvedRelease) return false;
    }

    return true;
  }

  function isContractCompletelySigned(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    if (cont.numberOfParties == 0) return false;
    return cont.numberOfParties == cont.involvedParties.length;
  }

  function isCallerInvolvedInContract(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];

    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) return true;
    }
    return false;
  }

  function getContract(uint256 contractId) public view returns(Contract memory) {
    return _contracts[contractId];
  }

  function approveRelease(uint256 contractId) public{
    require(isCallerInvolvedInContract(contractId), 'Address is not part of contract, cant procede');
    require(isContractCompletelySigned(contractId), 'Contract must be fully signed by all parties in order to approve release');
    
    Contract storage cont = _contracts[contractId];

    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            cont.involvedParties[i].approvedRelease = true;
        }
    }
  }

  function adhereToContract(uint256 contractId, uint256 amountToLock) public {
    require(!isContractCompletelySigned(contractId), "Cant join contract, it has already been signed by all involved parties");
    require(isCallerInvolvedInContract(contractId) == false, "Cant join contract, address has already signed this contract");
    
    ERC20(warrantyTokenAddress).transferFrom(msg.sender, address(this), amountToLock);
    Contract storage cont = _contracts[contractId];
    require(cont.numberOfParties != 0, "Cant join contract. Contract has not been initialized");

    ContractParty memory newContractParty = ContractParty({
        partyAddress: msg.sender,
        _lockedAmount: amountToLock,
        _withdrawnAmount: 0,
        approvedRelease: false
    });

    cont.involvedParties.push(newContractParty);
    _addressesToContract[msg.sender].push(cont._contractId);
  }

  function withdrawFromContract(uint256 contractId) external {
    require(isCallerInvolvedInContract(contractId), 'Address is not part of contract, cant procede');
    require(isContractRedeemable(contractId), "contract is not redeemable yet");

    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            require(cont.involvedParties[i]._lockedAmount > 0, "all funds for this address have been withdrawn");
            cont.involvedParties[i]._withdrawnAmount = cont.involvedParties[i]._lockedAmount;
            cont.involvedParties[i]._lockedAmount = 0;
            ERC20(warrantyTokenAddress).transfer(msg.sender, cont.involvedParties[i]._withdrawnAmount);
        }
    }
  }

  function getWithdrawnAmountForAddress(uint256 contractId) external view returns(uint256) {
    require(isCallerInvolvedInContract(contractId), 'Address is not part of contract, cant procede');

    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            return cont.involvedParties[i]._withdrawnAmount;
        }
    }
    return 0;
  }

  function getLockedAmountForAddress(uint256 contractId) external view returns(uint256) {
    require(isCallerInvolvedInContract(contractId), 'Address is not part of contract, cant procede');

    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            return cont.involvedParties[i]._lockedAmount;
        }
    }
    return 0;
  }

  function getWithdrawnAmountForContract(uint256 contractId) external view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.involvedParties.length; i++) {
        total += cont.involvedParties[i]._withdrawnAmount;
    }
    return total;
  }

  function getLockedAmountForContract(uint256 contractId) external view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.involvedParties.length; i++) {
        total += cont.involvedParties[i]._lockedAmount;
    }
    return total;
  }

  function createContract(uint256 numberOfParties) external {
    require(numberOfParties >= 2, 'Number of involved parties must be equal or greater than 2');
     _contractIdCounter.increment();
    uint256 contractId = _contractIdCounter.current();
    uint creationDate = block.timestamp;
    uint unlockTime = creationDate + (1 * 365 days);

    Contract storage newContract = _contracts[contractId];
    newContract._contractId = contractId;
    newContract.createdBy = msg.sender;
    newContract.unlockTime = unlockTime;
    newContract.numberOfParties = numberOfParties;
    _contracts[contractId] = newContract;
  }

  function getContractIdsForAddress() external view returns (uint256[] memory) {
    return _addressesToContract[msg.sender];  
  }
}