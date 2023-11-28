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
    

}
