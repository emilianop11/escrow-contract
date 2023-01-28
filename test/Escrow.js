const { expect } = require("chai");
const {ParseSolidityStruct} = require("solidity-struct-parser");

describe('Escrow', function () {
  beforeEach(async function() {
    [owner, wallet1, wallet2, wallet3, wallet4, walletHacker] = await ethers.getSigners();
    AnyToken = await ethers.getContractFactory('Any', owner);
    anyToken = await AnyToken.deploy();
    Escrow = await ethers.getContractFactory('Escrow', owner);
    escrow = await Escrow.deploy(anyToken.address);

    anyToken.connect(owner).transfer(wallet1.address, 1000);
    anyToken.connect(owner).transfer(wallet2.address, 1000);
    anyToken.connect(owner).transfer(wallet3.address, 1000);
    anyToken.connect(owner).transfer(wallet4.address, 1000);

    await anyToken.connect(wallet1).approve(
      escrow.address,
      5000
    );
    await anyToken.connect(wallet2).approve(
      escrow.address,
      5000
    );
    await anyToken.connect(wallet3).approve(
      escrow.address,
      5000
    );
    await anyToken.connect(wallet4).approve(
      escrow.address,
      5000
    );
  });

  describe('deployment', function () {
    it('should check empty states', async function () {
      const zeroContract = await escrow.connect(wallet1).getContract(0);
      expect(zeroContract._contractId).to.equal(0);

      const firstContract = await escrow.connect(wallet1).getContract(1);
      expect(firstContract._contractId).to.equal(0);

      const anyContract = await escrow.connect(wallet1).getContract(134);
      expect(firstContract._contractId).to.equal(0);
      
      const retrievedContractIdsForAddress = await escrow.connect(wallet1).getContractIdsForAddress();
      expect(retrievedContractIdsForAddress[0]).to.equal(undefined);

      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      expect(await escrow.connect(wallet1).isContractCompletelySigned(133)).to.equal(false);

      // a non fully signed contract is redeemable
      expect(await escrow.connect(wallet1).isContractRedeemable(122)).to.equal(true);

      expect(await escrow.connect(walletHacker).getLockedAmountForContract(33221)).to.equal(0);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1123123)).to.equal(0);
    })
  })

  describe('create contract', function () {
    it('should allow wallet 1 to create a contract between 2 parties', async function () {
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      const retrievedContractIdsForAddress = await escrow.connect(wallet1).getContractIdsForAddress();
      expect(retrievedContractIdsForAddress[0]).to.equal(undefined);
      const firstContract = await escrow.connect(wallet1).getContract(1);
      expect(firstContract.createdBy).to.equal(wallet1.address);
      expect(await escrow.connect(wallet1).isContractCompletelySigned(1)).to.equal(false);
      expect(await escrow.connect(wallet1).didCallerSignContract(1)).to.equal(false);
      expect(await escrow.connect(wallet1).isContractRedeemable(1)).to.equal(true);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      expect(await escrow.connect(wallet3).didCallerSignContract(1)).to.equal(false);
      expect(await escrow.connect(walletHacker).getLockedAmountForContract(1)).to.equal(0);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1)).to.equal(0);
      expect(await escrow.connect(wallet2).getTotalContractValue(122)).to.equal(0);
      expect(await escrow.connect(wallet2).getTotalContractValue(1)).to.equal(0);
    });
  });


  describe('adhere to contract', function () {
    it('should allow wallet 2 and 3 to adhere to a contract that doesnt have whitelisting', async function () {
     
      // check balances before we start
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      expect(await anyToken.balanceOf(escrow.address)).to.equal(0);
     
      await expect(escrow.connect(wallet2).adhereToContract(11, 100)).to.be.revertedWith("Cant join contract. Contract has not been initialized");
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      
      //adhere wallet2 to contract
      await expect(escrow.connect(wallet2).adhereToContract(1, 750000)).to.be.revertedWith("ERC20: insufficient allowance");
      await expect(escrow.connect(wallet2).adhereToContract(1, 4000)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      await escrow.connect(wallet2).adhereToContract(1, 100);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(true);
      expect(await escrow.connect(wallet2).isContractCompletelySigned(1)).to.equal(false);
      expect(await escrow.connect(wallet3).didCallerSignContract(1)).to.equal(false);
      await expect(escrow.connect(wallet2).approveRelease(1)).to.be.revertedWith("Contract must be fully signed by all parties in order to approve release");
      expect(await escrow.connect(wallet2).isContractRedeemable(1)).to.equal(true);

      //adhere wallet3 to contract
      await escrow.connect(wallet3).adhereToContract(1, 100);
      expect(await escrow.connect(wallet3).didCallerSignContract(1)).to.equal(true);
      expect(await escrow.connect(wallet3).isContractCompletelySigned(1)).to.equal(true);
      expect(await escrow.connect(wallet3).isContractRedeemable(1)).to.equal(false);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);
      expect(await anyToken.balanceOf(escrow.address)).to.equal(200);

      //try to withdraw before both approved the release
      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      
      // wallet 2 approves release of funds
      await expect(escrow.connect(wallet2).approveRelease(144)).to.be.revertedWith("Address is not part of contract, cant procede");
      await escrow.connect(wallet2).approveRelease(1);
      expect(await escrow.connect(wallet2).isContractRedeemable(1)).to.equal(false);
      expect(await escrow.connect(wallet3).isContractRedeemable(1)).to.equal(false);
      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");


      // wallet 3 also aproves release
      await escrow.connect(wallet3).approveRelease(1);
      expect(await escrow.connect(wallet2).isContractRedeemable(1)).to.equal(true);
      expect(await escrow.connect(wallet3).isContractRedeemable(1)).to.equal(true);


      // make sure balances still were not touched
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);
    

      // fully signed contract, check if someone else tries to withdraw
      await expect(escrow.connect(walletHacker).withdrawFromContract(1)).to.be.revertedWith("Address is not part of contract, cant procede");
    
      const contract = await escrow.connect(wallet1).getContract(1);
      expect(await escrow.connect(walletHacker).getLockedAmountForContract(1)).to.equal(200);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1)).to.equal(0);
      expect(contract.signerParties[0]._lockedAmount).to.equal(100);
      expect(contract.signerParties[1]._lockedAmount).to.equal(100);
      expect(contract.signerParties[0]._withdrawnAmount).to.equal(0);
      expect(contract.signerParties[1]._withdrawnAmount).to.equal(0);

      expect(await escrow.connect(wallet2).getWithdrawnAmountForAddress(1)).to.equal(0);
      expect(await escrow.connect(wallet2).getLockedAmountForAddress(1)).to.equal(100);
      expect(await escrow.connect(wallet3).getWithdrawnAmountForAddress(1)).to.equal(0);
      expect(await escrow.connect(wallet3).getLockedAmountForAddress(1)).to.equal(100);
      
      await escrow.connect(wallet2).withdrawFromContract(1);
      expect(await escrow.connect(wallet2).getWithdrawnAmountForAddress(1)).to.equal(100);
      expect(await escrow.connect(wallet2).getLockedAmountForAddress(1)).to.equal(0);
      expect(await escrow.connect(wallet3).getWithdrawnAmountForAddress(1)).to.equal(0);
      expect(await escrow.connect(wallet3).getLockedAmountForAddress(1)).to.equal(100);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);


      await escrow.connect(wallet3).withdrawFromContract(1);
      expect(await escrow.connect(wallet2).getWithdrawnAmountForAddress(1)).to.equal(100);
      expect(await escrow.connect(wallet2).getLockedAmountForAddress(1)).to.equal(0);
      expect(await escrow.connect(wallet3).getWithdrawnAmountForAddress(1)).to.equal(100);
      expect(await escrow.connect(wallet3).getLockedAmountForAddress(1)).to.equal(0);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      expect(await anyToken.balanceOf(escrow.address)).to.equal(0);

      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("all funds for this address have been withdrawn");

      expect(await escrow.connect(walletHacker).getLockedAmountForContract(1)).to.equal(0);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1)).to.equal(200);      
    
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(true);
      expect(await escrow.connect(wallet3).didCallerSignContract(1)).to.equal(true);
    });


    it('should not allow wallet 3 to adhere to a contract that does have whitelisting', async function () {
      await escrow.connect(wallet1).createContract("","",2, [wallet1.address, wallet2.address], 1);
      await expect(escrow.connect(wallet3).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract. Contract has address whitelisting enabled and address is not part of the list");
      await expect(escrow.connect(walletHacker).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract. Contract has address whitelisting enabled and address is not part of the list");
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(true);
    });

    it('should allow wallet 2 to retrieve funds if the contract hasnt been fully signed', async function () {
      await escrow.connect(wallet1).createContract("","",2, [], 1);

      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(true);
      expect(await escrow.connect(wallet3).getTotalContractValue(1)).to.equal(100);
      await escrow.connect(wallet2).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await escrow.connect(wallet2).didCallerSignContract(1)).to.equal(false);
      expect(await escrow.connect(wallet3).getTotalContractValue(1)).to.equal(0);
    });
  });


  describe('adhere to contract setting withdrawal proportions', function () {
    it('should check different conditions when wallet 2 and 3 try to adhere to a contract', async function () {
     
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await expect(escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 1e12)).to.be.revertedWith('proportion must be a number greater than 0 and less or equal than 1 million');
    
      await expect(escrow.connect(walletHacker).setWithdrawalConfigForContract(1, wallet2.address, 1e12)).to.be.revertedWith('Contract can only be modified by its creator');
      expect(await escrow.connect(wallet1).getWithdrawalProportionTotalForContract(1)).to.equal(0);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 500000);
      expect(await escrow.connect(wallet1).getWithdrawalProportionTotalForContract(1)).to.equal(500000);
      await expect(escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 100000)).to.be.revertedWith('address has already a configuration setup');
      await expect(escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 700000)).to.be.revertedWith('total proportion of fund withdrawal cant exceed 100%');
      
      
      // try to adhere to contract and it has not been fully configured
      await expect(escrow.connect(wallet3).adhereToContract(1, 100)).to.be.revertedWith("cant adhere to contract if proportion of withdrawal hasnt been fully configured. Percentage must add to 100%");

      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 500000);
      expect(await escrow.connect(wallet1).getWithdrawalProportionTotalForContract(1)).to.equal(1000000);
    
      await expect(escrow.connect(walletHacker).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, withdrawal conditions have been set and address is not part of them");
      await escrow.connect(wallet3).adhereToContract(1, 100);
      await escrow.connect(wallet2).adhereToContract(1, 100);

      expect(await escrow.connect(wallet2).isContractCompletelySigned(1), true);

    });

    it('should check that wallet 2 cant adhere if proportion doesnt reach 100%', async function () {
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 300000);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 300000);
      await expect(escrow.connect(wallet2).adhereToContract(1, 100)).to.be.revertedWith("cant adhere to contract if proportion of withdrawal hasnt been fully configured. Percentage must add to 100%");
    });

    it('should check that payments are correct using withdrawal proportion feature', async function () {
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 300000);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 700000);
      await escrow.connect(wallet3).adhereToContract(1, 100);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      await escrow.connect(wallet2).approveRelease(1);
      await escrow.connect(wallet3).approveRelease(1);

      expect(await escrow.connect(wallet3).getTotalContractValue(1)).to.equal(200);
      

      await escrow.connect(wallet2).withdrawFromContract(1);
      await escrow.connect(wallet3).withdrawFromContract(1);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(960);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1040);

      //try to withdraw again
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("all funds for this address have been withdrawn");
      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("all funds for this address have been withdrawn");
      expect(await escrow.connect(wallet3).getTotalContractValue(1)).to.equal(200);
    });

    it('should check boundary condition if withdraw proportion has been set and a non configured address tries to join', async function () {
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 300000);
      await expect(escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 800000)).to.be.revertedWith("total proportion of fund withdrawal cant exceed 100%");
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet3.address, 700000);
      await expect(escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet4.address, 100)).to.be.revertedWith("cant set further withdrawal configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");

      await escrow.connect(wallet2).adhereToContract(1, 100);
      await expect(escrow.connect(wallet4).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, withdrawal conditions have been set and address is not part of them");
    });
  });


  describe('check unlock time feature', function () {
    it('should allow wallet 2 to retrieve funds if the contract expired, even if it didnt reach consensus', async function () {
      await escrow.connect(wallet1).createContract("","",2, [wallet2.address, wallet3.address], 1);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      await escrow.connect(wallet3).adhereToContract(1, 100);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);

      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      
      //hone hour
      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      
      //seven days
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await escrow.connect(wallet2).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);

      await escrow.connect(wallet3).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);

    });

    it('should not allow wallet 2 to retrieve funds if the contract didnt expire', async function () {
      await escrow.connect(wallet1).createContract("","",2, [wallet2.address, wallet3.address], 365);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      await escrow.connect(wallet3).adhereToContract(1, 100);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);

      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      
      //hone hour
      await ethers.provider.send('evm_increaseTime', [60 * 60]);
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      
      //seven days
      await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
    });

  });


  describe('locking conditions check', function () {
    it('check that wallets lock the amount defined in the configuration', async function () {
     
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await expect(escrow.connect(wallet2).setLockConfigForContract(1, wallet2.address, 57)).to.be.revertedWith("Contract can only be modified by its creator");
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet2.address, 57);

      // try to adhere before lock config is finished
      await expect(escrow.connect(wallet2).adhereToContract(1, 57)).to.be.revertedWith("Cant join contract. Lock configuration not complete. The amount of entries must match the number of parties defined in the contract");

      await escrow.connect(wallet1).setLockConfigForContract(1, wallet3.address, 43);
      await expect(escrow.connect(wallet1).setLockConfigForContract(1, wallet4.address, 100)).to.be.revertedWith("cant set further lock configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");
      
      await expect(escrow.connect(wallet4).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking conditions have been set and address is not part of them");
      await expect(escrow.connect(wallet2).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking configuration has been set and amount to lock is different than the amount configured");
      await expect(escrow.connect(wallet3).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking configuration has been set and amount to lock is different than the amount configured");
      
      expect(await escrow.connect(wallet2).getAddressLockConfig(1, wallet2.address)).to.equal(57);
      expect(await escrow.connect(wallet1).getAddressLockConfig(1, wallet2.address)).to.equal(57);
      expect(await escrow.connect(wallet4).getAddressLockConfig(1, wallet3.address)).to.equal(43);
      await expect(escrow.connect(wallet4).getAddressLockConfig(1, wallet4.address)).to.be.revertedWith("lock config setting must be set for address");

      // lock correct amounts
      await escrow.connect(wallet2).adhereToContract(1, 57);
      await escrow.connect(wallet3).adhereToContract(1, 43);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(943);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(957);
    })
  });


  describe('locking conditions check for 3 party contract', function () {
    it('check that wallets lock the amount defined in the configuration', async function () {
     
      await escrow.connect(wallet1).createContract("","",3, [], 1);
      await expect(escrow.connect(wallet2).setLockConfigForContract(1, wallet2.address, 57)).to.be.revertedWith("Contract can only be modified by its creator");
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet2.address, 57);

      // try to adhere before lock config is finished
      await expect(escrow.connect(wallet2).adhereToContract(1, 57)).to.be.revertedWith("Cant join contract. Lock configuration not complete. The amount of entries must match the number of parties defined in the contract");

      await escrow.connect(wallet1).setLockConfigForContract(1, wallet3.address, 43);
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet4.address, 100);
      
    
      
      expect(await escrow.connect(wallet2).getAddressLockConfig(1, wallet2.address)).to.equal(57);
      expect(await escrow.connect(wallet1).getAddressLockConfig(1, wallet3.address)).to.equal(43);
      expect(await escrow.connect(wallet4).getAddressLockConfig(1, wallet4.address)).to.equal(100);
   
      // lock correct amounts
      await escrow.connect(wallet2).adhereToContract(1, 57);
      await escrow.connect(wallet3).adhereToContract(1, 43);
      await escrow.connect(wallet4).adhereToContract(1, 100);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(943);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(957);
      expect(await anyToken.balanceOf(wallet4.address)).to.equal(900);

      // lets be sure that nobody can take the funds until all approved release
      await escrow.connect(wallet2).approveRelease(1);
      await escrow.connect(wallet3).approveRelease(1);

      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet3).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet4).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");

      escrow.connect(wallet4).approveRelease(1);

      // now we can start withdrawing
      await escrow.connect(wallet2).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(957);
      expect(await anyToken.balanceOf(wallet4.address)).to.equal(900);

      await escrow.connect(wallet3).withdrawFromContract(1);
      await escrow.connect(wallet4).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet4.address)).to.equal(1000);

    })
  });

  describe('creator of contract is involved in the escrow', function () {
    it('check that wallets lock the amount defined in the configuration', async function () {
      await escrow.connect(wallet1).createContract("","",2, [], 1);
      await expect(escrow.connect(wallet2).setLockConfigForContract(1, wallet2.address, 57)).to.be.revertedWith("Contract can only be modified by its creator");
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet2.address, 57);

      // try to adhere before lock config is finished
      await expect(escrow.connect(wallet2).adhereToContract(1, 57)).to.be.revertedWith("Cant join contract. Lock configuration not complete. The amount of entries must match the number of parties defined in the contract");

      await escrow.connect(wallet1).setLockConfigForContract(1, wallet1.address, 43);
      await expect(escrow.connect(wallet1).setLockConfigForContract(1, wallet4.address, 100)).to.be.revertedWith("cant set further lock configs. Contract has defined a total amount of parties and adding one more config would exceed that amount");
      
      await expect(escrow.connect(wallet4).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking conditions have been set and address is not part of them");
      await expect(escrow.connect(wallet1).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking configuration has been set and amount to lock is different than the amount configured");
      await expect(escrow.connect(wallet2).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract, locking configuration has been set and amount to lock is different than the amount configured");
      
      expect(await escrow.connect(wallet1).getAddressLockConfig(1, wallet2.address)).to.equal(57);
      expect(await escrow.connect(wallet2).getAddressLockConfig(1, wallet2.address)).to.equal(57);
      expect(await escrow.connect(wallet4).getAddressLockConfig(1, wallet1.address)).to.equal(43);
      await expect(escrow.connect(wallet4).getAddressLockConfig(1, wallet4.address)).to.be.revertedWith("lock config setting must be set for address");

      // lock correct amounts
      await escrow.connect(wallet1).adhereToContract(1, 43);
      await escrow.connect(wallet2).adhereToContract(1, 57);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(943);
      expect(await anyToken.balanceOf(wallet1.address)).to.equal(957);

      await expect(escrow.connect(wallet1).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");
      await expect(escrow.connect(wallet2).withdrawFromContract(1)).to.be.revertedWith("contract is not redeemable yet");

      await escrow.connect(wallet1).approveRelease(1);
      await escrow.connect(wallet2).approveRelease(1);
      await escrow.connect(wallet1).withdrawFromContract(1);
      await escrow.connect(wallet2).withdrawFromContract(1);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet1.address)).to.equal(1000);
    })
  });

  describe('realistic scenarios', function () {
    it('test get functions before adhere', async function () {

      await escrow.connect(wallet1).createContract("the name","the description",2, [wallet2.address, wallet3.address], 1);

      const contsForAddress1 = await escrow.connect(wallet1).getContractsForAddress()
      const parsedContsForAddress1 = ParseSolidityStruct(contsForAddress1)
      const contsForAddress2 = await escrow.connect(wallet2).getContractsForAddress()
      const parsedContsForAddress2 = ParseSolidityStruct(contsForAddress2)
      const contsForAddress3 = await escrow.connect(wallet3).getContractsForAddress()
      const parsedContsForAddress3 = ParseSolidityStruct(contsForAddress3)
      expect(parsedContsForAddress1).to.eql([]);
      expect(parsedContsForAddress2).to.eql([
        {
          _contractId: 1,
          name: "the name",
          description: "the description",
          createdAt: parsedContsForAddress2[0].createdAt,
          createdBy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          totalContractValue: 0,
          unlockTime: parsedContsForAddress2[0].unlockTime,
          whiteListedParties: [
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
          ],
          numberOfParties: 2,
          signerParties: [],
          withdrawalConfig: [],
          lockConfig: []
        }
      ]);
      

      expect(parsedContsForAddress3).to.eql([
        {
          _contractId: 1,
          name: "the name",
          description: "the description",
          createdAt: parsedContsForAddress3[0].createdAt,
          createdBy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          totalContractValue: 0,
          unlockTime: parsedContsForAddress3[0].unlockTime,
          whiteListedParties: [
            "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
          ],
          numberOfParties: 2,
          signerParties: [],
          withdrawalConfig: [],
          lockConfig: []
        }
      ]);
      
    })

    it('test get functions', async function () {

      await escrow.connect(wallet1).createContract("the name","the description",2, [], 1);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      await escrow.connect(wallet3).adhereToContract(1, 100);

      const contsForAddress1 = await escrow.connect(wallet1).getContractsForAddress()
      const parsedContsForAddress1 = ParseSolidityStruct(contsForAddress1)
      const contsForAddress2 = await escrow.connect(wallet2).getContractsForAddress()
      const parsedContsForAddress2 = ParseSolidityStruct(contsForAddress2)
      const contsForAddress3 = await escrow.connect(wallet3).getContractsForAddress()
      const parsedContsForAddress3 = ParseSolidityStruct(contsForAddress3)

      expect(parsedContsForAddress1).to.eql([]);
      expect(parsedContsForAddress2).to.eql([
        {
          _contractId: 1,
          name: "the name",
          description: "the description",
          createdAt: parsedContsForAddress2[0].createdAt,
          createdBy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          totalContractValue: 200,
          unlockTime: parsedContsForAddress2[0].unlockTime,
          whiteListedParties: [],
          numberOfParties: 2,
          signerParties: [ {
              _lockedAmount: 100,
              _withdrawnAmount: 0,
              approvedRelease: false,
              partyAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            },
            {
              _lockedAmount: 100,
              _withdrawnAmount: 0,
              approvedRelease: false,
              partyAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            }
          ],
          withdrawalConfig: [],
          lockConfig: []
        }
      ]);
      

      expect(parsedContsForAddress3).to.eql([
        {
          _contractId: 1,
          name: "the name",
          description: "the description",
          createdAt: parsedContsForAddress3[0].createdAt,
          createdBy: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          totalContractValue: 200,
          unlockTime: parsedContsForAddress3[0].unlockTime,
          whiteListedParties: [],
          numberOfParties: 2,
          signerParties: [ {
              _lockedAmount: 100,
              _withdrawnAmount: 0,
              approvedRelease: false,
              partyAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            },
            {
              _lockedAmount: 100,
              _withdrawnAmount: 0,
              approvedRelease: false,
              partyAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            }
          ],
          withdrawalConfig: [],
          lockConfig: []
        }
      ]);
      
    })

    
  })


  describe('realistic scenarios', function () {
    it('2 parties, all configs. creator is a party', async function () {
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet1.address)).to.equal(1000);
      await escrow.connect(wallet1).createContract("","",2, [wallet1.address, wallet2.address], 1);
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet1.address, 200);
      await escrow.connect(wallet1).setLockConfigForContract(1, wallet2.address, 100);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet1.address, 333334);
      await escrow.connect(wallet1).setWithdrawalConfigForContract(1, wallet2.address, 666666);
      await escrow.connect(wallet1).adhereToContract(1, 200);
      await escrow.connect(wallet2).adhereToContract(1, 100);

      expect(await anyToken.balanceOf(wallet1.address)).to.equal(800);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);

      await escrow.connect(wallet1).approveRelease(1);
      await escrow.connect(wallet2).approveRelease(1);

      await escrow.connect(wallet1).withdrawFromContract(1);
      await escrow.connect(wallet2).withdrawFromContract(1);
      expect(await anyToken.balanceOf(wallet1.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1099);
      
    });
  });
})