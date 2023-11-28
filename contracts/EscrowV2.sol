// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowV2 {
    struct Participant {
        address addr;
        uint256 amountToLock;
        uint256 amountToWithdraw;
    }

    struct Contract {
        string title;
        string description;
        uint256 contractId;
        Participant[] participants;
        uint256 unlockTime;
        address warrantyTokenAddress;
        bool unlockAtCreationState;
        bool isLocked;
        mapping(address => uint256) depositedAmounts; // Track actual deposited amounts
        mapping(address => bool) hasSigned;
        mapping(address => bool) approvals;
        mapping(address => bool) hasWithdrawn;
        mapping(address => bool) hasAdhered;
        bool anyWithdrawn; // New field to track if any withdrawal has occurred
    }

    struct ContractDetails {
        string title;
        string description;
        Participant[] participants;
        uint256 unlockTime;
        bool unlockAtCreationState;
        bool isLocked;
        uint256[] depositedAmounts;
    }

    Contract[] public contracts;

    function createContract(string memory _title, string memory _description, Participant[] memory _participants, uint256 _unlockTime, address _warrantyTokenAddress, bool _unlockAtCreationState) public {
        require(_participants.length >= 2, "Minimum of 2 participants required");
        
        uint256 totalToLock = 0;
        uint256 totalToWithdraw = 0;

        for(uint i = 0; i < _participants.length; i++) {
            totalToLock += _participants[i].amountToLock;
            totalToWithdraw += _participants[i].amountToWithdraw;
        }

        require(totalToLock == totalToWithdraw, "Total lock and withdraw amounts must be equal");
        require(_unlockTime > block.timestamp, "Unlock time must be in the future");
        require(isValidERC20(_warrantyTokenAddress), "Invalid ERC20 token address");

        Contract storage newContract = contracts.push();
        newContract.title = _title;
        newContract.description = _description;
        newContract.contractId = contracts.length - 1;
        newContract.unlockTime = _unlockTime;
        newContract.warrantyTokenAddress = _warrantyTokenAddress;
        newContract.unlockAtCreationState = _unlockAtCreationState;
        newContract.isLocked = false;

        for(uint i = 0; i < _participants.length; i++) {
            newContract.participants.push(_participants[i]);
        }
    }

    function isValidERC20(address _tokenAddress) internal view returns (bool) {
        (bool success, bytes memory data) = _tokenAddress.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        return success && data.length > 0;
    }

    function adhereToContract(uint256 _contractId) public {
        Contract storage c = contracts[_contractId];
        require(c.isLocked == false, "Contract is already locked");
        require(!c.hasAdhered[msg.sender], "Caller has already adhered");
        require(!c.anyWithdrawn, "Withdrawal has already occurred");
        require(isParticipant(_contractId, msg.sender), "Caller is not a participant");

        uint256 amountToLock;
        for(uint i = 0; i < c.participants.length; i++) {
            if(c.participants[i].addr == msg.sender) {
                amountToLock = c.participants[i].amountToLock;
                break;
            }
        }

        IERC20(c.warrantyTokenAddress).transferFrom(msg.sender, address(this), amountToLock);
        c.depositedAmounts[msg.sender] += amountToLock; // Update deposited amount

        // Check if all participants have deposited their amounts
        uint256 totalDeposited = 0;
        for(uint i = 0; i < c.participants.length; i++) {
            totalDeposited += c.depositedAmounts[c.participants[i].addr];
        }

        if(totalDeposited == getTotalToLock(c)) {
            c.isLocked = true;
        }
        c.hasAdhered[msg.sender] = true;
    }

    function getTotalToLock(Contract storage c) internal view returns (uint256) {
        uint256 totalToLock = 0;
        for(uint i = 0; i < c.participants.length; i++) {
            totalToLock += c.participants[i].amountToLock;
        }
        return totalToLock;
    }

    function approveUnlock(uint256 _contractId) public {
        Contract storage c = contracts[_contractId];
        require(c.isLocked, "Contract is not locked");
        require(isParticipant(_contractId, msg.sender), "Caller is not a participant");

        c.approvals[msg.sender] = true;
    }

    function isContractLocked(uint256 _contractId) public view returns (bool) {
        return contracts[_contractId].isLocked;
    }

    function isParticipant(uint256 _contractId, address _participant) internal view returns (bool) {
        Contract storage c = contracts[_contractId];
        for(uint i = 0; i < c.participants.length; i++) {
            if(c.participants[i].addr == _participant) {
                return true;
            }
        }
        return false;
    }


    function withdrawFromContract(uint256 _contractId) public {
        Contract storage c = contracts[_contractId];
        require(isParticipant(_contractId, msg.sender), "Caller is not a participant");
        require(!c.hasWithdrawn[msg.sender], "Participant has already withdrawn");

        uint256 amountToTransfer;
        bool isFullySigned = allParticipantsAdhered(c);

        if (isFullySigned && block.timestamp > c.unlockTime) {
            // All participants adhered and after unlockTime
            if (c.unlockAtCreationState) {
                amountToTransfer = c.depositedAmounts[msg.sender]; // Amount deposited
            } else {
                amountToTransfer = getWithdrawAmount(c, msg.sender); // Configured withdrawal amount
            }
        } else if (isFullySigned) {
            // For a fully signed, locked contract before unlockTime, check all participants approved
            require(allParticipantsApproved(c), "Not all participants approved unlock");
            amountToTransfer = getWithdrawAmount(c, msg.sender);
        } else {
            // Contract is not fully signed - withdraw amount deposited
            amountToTransfer = c.depositedAmounts[msg.sender];
        }

        IERC20(c.warrantyTokenAddress).transfer(msg.sender, amountToTransfer);
        c.hasWithdrawn[msg.sender] = true; // Mark as withdrawn after successful withdrawa
        c.anyWithdrawn = true; // Mark that a withdrawal has occurred
    }

    function getLockedAmount(Contract storage c, address participant) internal view returns (uint256) {
        for(uint i = 0; i < c.participants.length; i++) {
            if(c.participants[i].addr == participant) {
                return c.participants[i].amountToLock;
            }
        }
        return 0;
    }

    function allParticipantsAdhered(Contract storage c) internal view returns (bool) {
        for(uint i = 0; i < c.participants.length; i++) {
            if(c.depositedAmounts[c.participants[i].addr] < c.participants[i].amountToLock) {
                return false;
            }
        }
        return true;
    }

    function getWithdrawAmount(Contract storage c, address participant) internal view returns (uint256) {
        for(uint i = 0; i < c.participants.length; i++) {
            if(c.participants[i].addr == participant) {
                return c.participants[i].amountToWithdraw;
            }
        }
        return 0;
    }

    function allParticipantsApproved(Contract storage c) internal view returns (bool) {
        for(uint i = 0; i < c.participants.length; i++) {
            if(!c.approvals[c.participants[i].addr]) {
                return false;
            }
        }
        return true;
    }

    function getContractsForParticipant(address participant) public view returns (ContractDetails[] memory) {
        uint256 totalContracts = contracts.length;
        uint256 count = 0;

        // Count the relevant contracts
        for (uint256 i = 0; i < totalContracts; i++) {
            for (uint256 j = 0; j < contracts[i].participants.length; j++) {
                if (contracts[i].participants[j].addr == participant) {
                    count++;
                    break;
                }
            }
        }

        ContractDetails[] memory participantContracts = new ContractDetails[](count);
        count = 0;

        // Populate the result array
        for (uint256 i = 0; i < totalContracts; i++) {
            Contract storage c = contracts[i];
            for (uint256 j = 0; j < c.participants.length; j++) {
                if (c.participants[j].addr == participant) {
                    uint256[] memory depositedAmounts = new uint256[](c.participants.length);
                    for (uint256 k = 0; k < c.participants.length; k++) {
                        depositedAmounts[k] = c.depositedAmounts[c.participants[k].addr];
                    }
                    
                    participantContracts[count] = ContractDetails({
                        title: c.title,
                        description: c.description,
                        participants: c.participants,
                        unlockTime: c.unlockTime,
                        unlockAtCreationState: c.unlockAtCreationState,
                        isLocked: c.isLocked,
                        depositedAmounts: depositedAmounts
                    });
                    count++;
                    break;
                }
            }
        }

        return participantContracts;
    }

}
