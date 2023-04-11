// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
//import "hardhat/console.sol";

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
      uint createdAt;
      uint unlockTime;
      address[] whiteListedParties;
      uint256 numberOfParties;
      string name;
      string description;
      ContractParty[] signerParties;
      WithdrawalConfig[] withdrawalConfig;
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

    for (uint i = 0; i < cont.signerParties.length; i++) {
        if (!cont.signerParties[i].approvedRelease) return false;
    }

    return true;
  }

  function isContractInDraft(uint256 contractId) public view returns(bool) {
    Contract memory cont = getContract(contractId);
    return cont.signerParties.length == 0;
  }

  function isContractCompletelySigned(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    if (cont.numberOfParties == 0) return false;
    return cont.numberOfParties == cont.signerParties.length;
  }

  function isAddressWhitelistedInContract(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];
    if (cont.whiteListedParties.length == 0) return true;

    for (uint i = 0; i < cont.whiteListedParties.length; i++) {
        if (cont.whiteListedParties[i] == msg.sender) return true;
    }
    return false;
  }

  function didCallerSignContract(uint256 contractId) public view returns(bool) {
    Contract storage cont = _contracts[contractId];

    for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) return true;
    }
    return false;
  }

  function getContract(uint256 contractId) public view returns(Contract memory) {
    return _contracts[contractId];
  }

  function approveRelease(uint256 contractId) public{
    require(didCallerSignContract(contractId), 'Address is not part of contract');
    require(isContractCompletelySigned(contractId), 'Contract must be signed by all parties in order to approve release');
    
    Contract storage cont = _contracts[contractId];

    for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) {
            cont.signerParties[i].approvedRelease = true;
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
    require(hasAddressWithdrawConfigSet(contractId, _address), "withdrawal proportion must be set for address");
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.withdrawalConfig.length; i++) {
        if (cont.withdrawalConfig[i].partyAddress == _address) {
            return cont.withdrawalConfig[i].withdrawalProportion;
        }
    }
    return 0;
  }

  function getAddressLockConfig(uint256 contractId, address _address) public view returns(uint256) {
    require(hasAddressLockConfigSet(contractId, _address), "lock config must be set for address");
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
    require(cont.numberOfParties != 0, "Contract has not been initialized");
    require(isAddressWhitelistedInContract(contractId), "Contract has address whitelisting enabled and address is not part of the list");
    require(!isContractCompletelySigned(contractId), "Contract  has already been signed by all involved parties");
    require(didCallerSignContract(contractId) == false, "Address has already signed this contract");
    require(amountToLock > 0, "Amount to lock must be greater than 0");
    
    if (isWithdrawalProportionConfigSet(contractId)) {
      require(getWithdrawalProportionTotalForContract(contractId) == 1000000, "cant adhere to contract if proportion of withdrawal hasnt been fully configured. Percentage must add to 100%");
      require(hasAddressWithdrawConfigSet(contractId, msg.sender), "withdrawal conditions have been set and address is not part of them");
      require(cont.numberOfParties == cont.withdrawalConfig.length, "Withdrawal configuration not complete. The amount of entries must match the number of parties defined in the contract");
    }

    if (isLockConfigSet(contractId)) {
      require(hasAddressLockConfigSet(contractId, msg.sender), "locking conditions have been set and address is not part of them");
      require(getAddressLockConfig(contractId, msg.sender) == amountToLock, "locking configuration has been set and amount to lock is different than the amount configured");
      require(cont.numberOfParties == cont.lockConfig.length, "Lock configuration not complete. The amount of entries must match the number of parties defined in the contract");
    }

    ERC20(warrantyTokenAddress).transferFrom(msg.sender, address(this), amountToLock);
    
    ContractParty memory newContractParty = ContractParty({
        partyAddress: msg.sender,
        _lockedAmount: amountToLock,
        _withdrawnAmount: 0,
        approvedRelease: false
    });

    cont.signerParties.push(newContractParty);
    cont.totalContractValue += amountToLock;

    // avoid pushing duplicates
    uint256[] memory contractsForAddress = _addressesToContract[msg.sender];
    bool alreadyIncluded = false;
    for (uint i = 0; i < contractsForAddress.length; i++) {
        if (contractsForAddress[i] == cont._contractId ) {
            alreadyIncluded = true;
            break;
        }
    }

    if (!alreadyIncluded) {
      _addressesToContract[msg.sender].push(cont._contractId);
    }
  }

  function withdrawFromContract(uint256 contractId) external {
    require(didCallerSignContract(contractId), 'Address is not part of contract');
    require(isContractRedeemable(contractId), "contract is not redeemable yet");

    bool isContractFullySigned = isContractCompletelySigned(contractId);
    Contract storage cont = _contracts[contractId];

    if (!isWithdrawalProportionConfigSet(contractId)) {
      for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) {
            require(cont.signerParties[i]._lockedAmount > 0, "all funds for this address have been withdrawn");
            cont.signerParties[i]._withdrawnAmount = cont.signerParties[i]._lockedAmount;
            cont.signerParties[i]._lockedAmount = 0;
            ERC20(warrantyTokenAddress).transfer(msg.sender, cont.signerParties[i]._withdrawnAmount);
            
            if (!isContractFullySigned) {
              cont.totalContractValue -= cont.signerParties[i]._withdrawnAmount;
              delete cont.signerParties[i];
            }

            return;
        }
      }
    } else {
      for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) {
            require(cont.signerParties[i]._lockedAmount > 0, "all funds for this address have been withdrawn");
            uint256 amtToWithdraw;
            if (isContractFullySigned) {
              uint256 withdrawalProportion = getAddressWithdrawProportion(contractId, msg.sender);
              amtToWithdraw = cont.totalContractValue * withdrawalProportion / 1000000;
              cont.signerParties[i]._withdrawnAmount = amtToWithdraw;
            } else {
              amtToWithdraw = cont.signerParties[i]._lockedAmount;
              cont.totalContractValue -= amtToWithdraw;
              delete cont.signerParties[i];
            }
            cont.signerParties[i]._lockedAmount = 0;
            ERC20(warrantyTokenAddress).transfer(msg.sender, amtToWithdraw);
            return;
        }
      }
    }
  }

  function getWithdrawnAmountForAddress(uint256 contractId) external view returns(uint256) {
    require(didCallerSignContract(contractId), 'Address is not part of contract');

    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) {
            return cont.signerParties[i]._withdrawnAmount;
        }
    }
    return 0;
  }

  function getLockedAmountForAddress(uint256 contractId) external view returns(uint256) {
    require(didCallerSignContract(contractId), 'Address is not part of contract');

    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.signerParties.length; i++) {
        if (cont.signerParties[i].partyAddress == msg.sender) {
            return cont.signerParties[i]._lockedAmount;
        }
    }
    return 0;
  }

  function getWithdrawnAmountForContract(uint256 contractId) external view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.signerParties.length; i++) {
        total += cont.signerParties[i]._withdrawnAmount;
    }
    return total;
  }

  function getLockedAmountForContract(uint256 contractId) external view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.signerParties.length; i++) {
        total += cont.signerParties[i]._lockedAmount;
    }
    return total;
  }

  function setLockConfigForContract(uint256 contractId, address _address, uint256 _amountToLock) public {
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

  function setWithdrawalConfigForContract(uint256 contractId, address _address, uint256 proportion) public {
    Contract storage cont = _contracts[contractId];
    require(cont.createdBy == msg.sender, "Contract can only be modified by its creator");
    require(isContractInDraft(contractId), "proportion of withdrawal can only be set in a draft contract. A draft contract is a contract that hasnt been signed by any party yet.");
    require(cont.numberOfParties > cont.withdrawalConfig.length, "cant set further withdrawal configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");
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

  function createContract(
      string calldata _name,
      string calldata _description,
      uint256 numberOfParties,
      address[] memory _whiteListedParties,
      uint256 daysToUnlock,
      LockConfig[] calldata _lockConfig,
      WithdrawalConfig[] calldata _withdrawalConfig
    ) external {
    require(numberOfParties >= 2, 'Number of parties must be >= 2');
     _contractIdCounter.increment();
    uint256 contractId = _contractIdCounter.current();
    uint creationDate = block.timestamp;
    uint unlockTime = creationDate + (daysToUnlock * 1 days);

    Contract storage newContract = _contracts[contractId];
    newContract._contractId = contractId;
    newContract.name = _name;
    newContract.createdAt = creationDate;
    newContract.description = _description;
    newContract.createdBy = msg.sender;
    newContract.whiteListedParties = _whiteListedParties;
    newContract.unlockTime = unlockTime;
    newContract.numberOfParties = numberOfParties;

    if (_lockConfig.length > 0 || _withdrawalConfig.length > 0) {
      require(_lockConfig.length == numberOfParties, "conf must be completely defined");
      require(_withdrawalConfig.length == numberOfParties, "conf must be completely defined");
    }

    for (uint i = 0; i < _lockConfig.length; i++) {
      setLockConfigForContract(contractId, _lockConfig[i].partyAddress, _lockConfig[i].amountToLock);
    }

    for (uint i = 0; i < _withdrawalConfig.length; i++) {
      setWithdrawalConfigForContract(contractId, _withdrawalConfig[i].partyAddress, _withdrawalConfig[i].withdrawalProportion);
    }

    _contracts[contractId] = newContract;
    for (uint i = 0; i < _whiteListedParties.length; i++) {
      _addressesToContract[_whiteListedParties[i]].push(contractId);
    }
  }

  function getWithdrawalProportionTotalForContract(uint256 contractId) public view returns(uint256) {
    uint256 total = 0;
    Contract storage cont = _contracts[contractId];
    for (uint i = 0; i < cont.withdrawalConfig.length; i++) {
        total += cont.withdrawalConfig[i].withdrawalProportion;
    }
    return total;
  }

  function getContractsForAddress() external view returns (Contract[] memory) {
    uint256[] storage contractIds = _addressesToContract[msg.sender];
    Contract[] memory contracts = new Contract[](contractIds.length);
    for (uint i = 0; i < contractIds.length; i++) {
        uint256 contractId = contractIds[i];
        Contract storage cont = _contracts[contractId];
        contracts[i] = cont;
    }
    return contracts;
  }

  function getTotalContractValue(uint256 contractId) external view returns (uint256) {
    Contract storage cont = _contracts[contractId];
    return cont.totalContractValue;
  }
}