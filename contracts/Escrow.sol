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

  struct WithdrawalConfig {
    address partyAddress;
    uint256 withdrawalProportion;
  }

  struct LockConfig {
    address partyAddress;
    uint256 amountToLock;
  }

  struct Contract{
      uint256 _contractId;
      address createdBy;
      uint256 totalContractValue;
      uint unlockTime;
      address[] whiteListedParties;
      uint256 numberOfParties;
      ContractParty[] involvedParties;
      // definition of which proportion of the locked funds can be withdrawn by each party when the contract is redeemable
      WithdrawalConfig[] withdrawalConfig;
      // definition of how much each address must lock in the contract
      LockConfig[] lockConfig;
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

    if (block.timestamp > cont.unlockTime) return true;

    for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (!cont.involvedParties[i].approvedRelease) return false;
    }

    return true;
  }

  function isContractInDraft(uint256 contractId) public view returns(bool) {
    Contract memory cont = getContract(contractId);
    return cont.involvedParties.length == 0;
  }

  function isContractCompletelySigned(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    if (cont.numberOfParties == 0) return false;
    return cont.numberOfParties == cont.involvedParties.length;
  }

  function isAddressWhitelistedInContract(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    if (cont.whiteListedParties.length == 0) return true;

    for (uint i = 0; i < cont.whiteListedParties.length; i++) {
        if (cont.whiteListedParties[i] == msg.sender) return true;
    }
    return false;
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

  function isWithdrawalProportionConfigSet(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    return cont.withdrawalConfig.length > 0;
  }

  function isLockConfigSet(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    return cont.lockConfig.length > 0;
  }

  function hasAddressWithdrawConfigSet(uint256 contractId, address _address) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    
    for (uint i = 0; i < cont.withdrawalConfig.length; i++) {
        if (cont.withdrawalConfig[i].partyAddress == _address) {
            return true;
        }
    }

    return false;
  }

  function hasAddressLockConfigSet(uint256 contractId, address _address) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    
    for (uint i = 0; i < cont.lockConfig.length; i++) {
        if (cont.lockConfig[i].partyAddress == _address) {
            return true;
        }
    }
    return false;
  }

  function getAddressWithdrawProportion(uint256 contractId, address _address) public view returns(uint256) {
    require(hasAddressWithdrawConfigSet(contractId, _address), "withdrawal proportion setting must be set for address");
    Contract storage cont = _contracts[contractId];
    
    for (uint i = 0; i < cont.withdrawalConfig.length; i++) {
        if (cont.withdrawalConfig[i].partyAddress == _address) {
            return cont.withdrawalConfig[i].withdrawalProportion;
        }
    }
    return 0;
  }

  function getAddressLockConfig(uint256 contractId, address _address) public view returns(uint256) {
    require(hasAddressLockConfigSet(contractId, _address), "lock config setting must be set for address");
    Contract storage cont = _contracts[contractId];
    
    for (uint i = 0; i < cont.lockConfig.length; i++) {
        if (cont.lockConfig[i].partyAddress == _address) {
            return cont.lockConfig[i].amountToLock;
        }
    }
    return 0;
  }

  function adhereToContract(uint256 contractId, uint256 amountToLock) public {
    Contract storage cont = _contracts[contractId];
    require(cont.numberOfParties != 0, "Cant join contract. Contract has not been initialized");
    
    require(isAddressWhitelistedInContract(contractId), "Cant join contract. Contract has address whitelisting enabled and address is not part of the list");
    require(!isContractCompletelySigned(contractId), "Cant join contract, it has already been signed by all involved parties");
    require(isCallerInvolvedInContract(contractId) == false, "Cant join contract, address has already signed this contract");
    require(amountToLock > 0, "Amount to lock must be greater than 0");
    
    if (isWithdrawalProportionConfigSet(contractId)) {
      require(getWithdrawalProportionTotalForContract(contractId) == 1000000, "cant adhere to contract if proportion of withdrawal hasnt been fully configured");
      require(hasAddressWithdrawConfigSet(contractId, msg.sender), "Cant join contract, withdrawal conditions have been set and address is not part of them");
      require(cont.numberOfParties == cont.withdrawalConfig.length, "Cant join contract. Withdrawal configuration not complete. The amount of entries must match the number of parties defined in the contract");
    }

    if (isLockConfigSet(contractId)) {
      require(hasAddressLockConfigSet(contractId, msg.sender), "Cant join contract, locking conditions have been set and address is not part of them");
      require(getAddressLockConfig(contractId, msg.sender) == amountToLock, "Cant join contract, locking configuration has been set and amount to lock is different than the amount configured");
      require(cont.numberOfParties == cont.lockConfig.length, "Cant join contract. Lock configuration not complete. The amount of entries must match the number of parties defined in the contract");
    }

    ERC20(warrantyTokenAddress).transferFrom(msg.sender, address(this), amountToLock);
    
    ContractParty memory newContractParty = ContractParty({
        partyAddress: msg.sender,
        _lockedAmount: amountToLock,
        _withdrawnAmount: 0,
        approvedRelease: false
    });

    cont.involvedParties.push(newContractParty);
    cont.totalContractValue += amountToLock;
    _addressesToContract[msg.sender].push(cont._contractId);
  }

  function withdrawFromContract(uint256 contractId) external {
    require(isCallerInvolvedInContract(contractId), 'Address is not part of contract, cant procede');
    require(isContractRedeemable(contractId), "contract is not redeemable yet");

    bool isContractFullySigned = isContractCompletelySigned(contractId);
    Contract storage cont = _contracts[contractId];

    if (!isWithdrawalProportionConfigSet(contractId)) {
      for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            require(cont.involvedParties[i]._lockedAmount > 0, "all funds for this address have been withdrawn");
            cont.involvedParties[i]._withdrawnAmount = cont.involvedParties[i]._lockedAmount;
            cont.involvedParties[i]._lockedAmount = 0;
            ERC20(warrantyTokenAddress).transfer(msg.sender, cont.involvedParties[i]._withdrawnAmount);
            
            if (!isContractFullySigned) {
              cont.totalContractValue -= cont.involvedParties[i]._withdrawnAmount;
              delete cont.involvedParties[i];
            }

            return;
        }
      }
    } else {
      for (uint i = 0; i < cont.involvedParties.length; i++) {
        if (cont.involvedParties[i].partyAddress == msg.sender) {
            require(cont.involvedParties[i]._lockedAmount > 0, "all funds for this address have been withdrawn");
            uint256 withdrawalProportion = getAddressWithdrawProportion(contractId, msg.sender);
            cont.involvedParties[i]._withdrawnAmount = cont.totalContractValue * withdrawalProportion / 1000000;
            cont.involvedParties[i]._lockedAmount = 0;
            ERC20(warrantyTokenAddress).transfer(msg.sender, cont.involvedParties[i]._withdrawnAmount);
            
            if (!isContractFullySigned) {
              cont.totalContractValue -= cont.involvedParties[i]._withdrawnAmount;
              delete cont.involvedParties[i];
            }

            return;
        }
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

  function createContract(uint256 numberOfParties, address[] memory _whiteListedParties, uint256 daysToUnlock) external {
    require(numberOfParties >= 2, 'Number of involved parties must be equal or greater than 2');
     _contractIdCounter.increment();
    uint256 contractId = _contractIdCounter.current();
    uint creationDate = block.timestamp;
    uint unlockTime = creationDate + (daysToUnlock * 1 days);

    Contract storage newContract = _contracts[contractId];
    newContract._contractId = contractId;
    newContract.createdBy = msg.sender;
    newContract.whiteListedParties = _whiteListedParties;
    newContract.unlockTime = unlockTime;
    newContract.numberOfParties = numberOfParties;
    _contracts[contractId] = newContract;
  }

  function getWithdrawalProportionTotalForContract(uint256 contractId) public view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];

    // otherwise, check and accum
    for (uint i = 0; i < cont.withdrawalConfig.length; i++) {
        total += cont.withdrawalConfig[i].withdrawalProportion;
    }
    return total;
  }


  function setLockConfigForContract(uint256 contractId, address _address, uint256 _amountToLock) external {
    Contract storage cont = _contracts[contractId];
    require(cont.createdBy == msg.sender, "Contract can only be modified by its creator");
    require(isContractInDraft(contractId), "lock config can only be set in a draft contract. A draft contract is a contract that hasnt been signed by any party yet.");
    require(cont.numberOfParties > cont.lockConfig.length, "cant set further lock configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");
    require(!hasAddressLockConfigSet(contractId, _address), "address has already a configuration setup");

    LockConfig memory conf = LockConfig({
      partyAddress: _address,
      amountToLock: _amountToLock
    });

    cont.lockConfig.push(conf);
  }

  function setWithdrawalConfigForContract(uint256 contractId, address _address, uint256 proportion) external {
    Contract storage cont = _contracts[contractId];
    require(cont.createdBy == msg.sender, "Contract can only be modified by its creator");
    require(isContractInDraft(contractId), "proportion of withdrawal can only be set in a draft contract. A draft contract is a contract that hasnt been signed by any party yet.");
    require(cont.numberOfParties > cont.lockConfig.length, "cant set further withdrawal configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");
    require(proportion > 0 && proportion <= 1000000, "proportion must be a number greater than 0 and less or equal than 1 million");
    require(!hasAddressWithdrawConfigSet(contractId, _address), "address has already a configuration setup");
    uint256 currentTotalProportion = getWithdrawalProportionTotalForContract(contractId);
    require((currentTotalProportion + proportion) <= 1000000, "total proportion of fund withdrawal cant exceed 100%");

    WithdrawalConfig memory conf = WithdrawalConfig({
        partyAddress: _address,
        withdrawalProportion: proportion
    });

    cont.withdrawalConfig.push(conf);
  }

  function getContractIdsForAddress() external view returns (uint256[] memory) {
    return _addressesToContract[msg.sender];  
  }

  function getTotalContractValue(uint256 contractId) external view returns (uint256) {
    Contract storage cont = _contracts[contractId];
    return cont.totalContractValue;
  }
}