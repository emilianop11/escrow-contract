const { expect } = require("chai");

describe('Escrow', function () {
  beforeEach(async function() {
    [owner, wallet1, wallet2, wallet3, walletHacker] = await ethers.getSigners();
    AnyToken = await ethers.getContractFactory('Any', owner);
    anyToken = await AnyToken.deploy();
    Escrow = await ethers.getContractFactory('Escrow', owner);
    escrow = await Escrow.deploy(anyToken.address);

    anyToken.connect(owner).transfer(wallet1.address, 1000);
    anyToken.connect(owner).transfer(wallet2.address, 1000);
    anyToken.connect(owner).transfer(wallet3.address, 1000);

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

      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(false);
      expect(await escrow.connect(wallet1).isContractCompletelySigned(133)).to.equal(false);

      // a non fully signed contract is redeemable
      expect(await escrow.connect(wallet1).isContractRedeemable(122)).to.equal(true);

      expect(await escrow.connect(walletHacker).getLockedAmountForContract(33221)).to.equal(0);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1123123)).to.equal(0);
    })
  })

  describe('create contract', function () {
    it('should allow wallet 1 to create a contract between 2 parties', async function () {
      await escrow.connect(wallet1).createContract(2, []);
      const retrievedContractIdsForAddress = await escrow.connect(wallet1).getContractIdsForAddress();
      expect(retrievedContractIdsForAddress[0]).to.equal(undefined);
      const firstContract = await escrow.connect(wallet1).getContract(1);
      expect(firstContract.createdBy).to.equal(wallet1.address);
      expect(await escrow.connect(wallet1).isContractCompletelySigned(1)).to.equal(false);
      expect(await escrow.connect(wallet1).isCallerInvolvedInContract(1)).to.equal(false);
      expect(await escrow.connect(wallet1).isContractRedeemable(1)).to.equal(true);
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(false);
      expect(await escrow.connect(wallet3).isCallerInvolvedInContract(1)).to.equal(false);
      expect(await escrow.connect(walletHacker).getLockedAmountForContract(1)).to.equal(0);
      expect(await escrow.connect(walletHacker).getWithdrawnAmountForContract(1)).to.equal(0);

    });
  });


  describe('adhere to contract', function () {
    it('should allow wallet 2 and 3 to adhere to a contract that doesnt have whitelisting', async function () {
     
      // check balances before we start
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1000);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      expect(await anyToken.balanceOf(escrow.address)).to.equal(0);
     
      await expect(escrow.connect(wallet2).adhereToContract(11, 100)).to.be.revertedWith("Cant join contract. Contract has not been initialized");
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(false);
      await escrow.connect(wallet1).createContract(2, []);
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(false);
      
      //adhere wallet2 to contract
      await expect(escrow.connect(wallet2).adhereToContract(1, 750000)).to.be.revertedWith("ERC20: insufficient allowance");
      await expect(escrow.connect(wallet2).adhereToContract(1, 4000)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      await escrow.connect(wallet2).adhereToContract(1, 100);
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(true);
      expect(await escrow.connect(wallet2).isContractCompletelySigned(1)).to.equal(false);
      expect(await escrow.connect(wallet3).isCallerInvolvedInContract(1)).to.equal(false);
      await expect(escrow.connect(wallet2).approveRelease(1)).to.be.revertedWith("Contract must be fully signed by all parties in order to approve release");
      expect(await escrow.connect(wallet2).isContractRedeemable(1)).to.equal(true);

      //adhere wallet3 to contract
      await escrow.connect(wallet3).adhereToContract(1, 100);
      expect(await escrow.connect(wallet3).isCallerInvolvedInContract(1)).to.equal(true);
      expect(await escrow.connect(wallet3).isContractCompletelySigned(1)).to.equal(true);
      expect(await escrow.connect(wallet3).isContractRedeemable(1)).to.equal(false);

      expect(await anyToken.balanceOf(wallet2.address)).to.equal(900);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(900);

      expect(await anyToken.balanceOf(escrow.address)).to.equal(200);

      // wallet 2 approves release of funds
      await expect(escrow.connect(wallet2).approveRelease(144)).to.be.revertedWith("Address is not part of contract, cant procede");
      await escrow.connect(wallet2).approveRelease(1);
      expect(await escrow.connect(wallet2).isContractRedeemable(1)).to.equal(false);
      expect(await escrow.connect(wallet3).isContractRedeemable(1)).to.equal(false);

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
      expect(contract.involvedParties[0]._lockedAmount).to.equal(100);
      expect(contract.involvedParties[1]._lockedAmount).to.equal(100);
      expect(contract.involvedParties[0]._withdrawnAmount).to.equal(0);
      expect(contract.involvedParties[1]._withdrawnAmount).to.equal(0);

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
    });


    it('should not allow wallet 3 to adhere to a contract that does have whitelisting', async function () {
      await escrow.connect(wallet1).createContract(2, [wallet1.address, wallet2.address]);
      await expect(escrow.connect(wallet3).adhereToContract(1, 100)).to.be.revertedWith("Cant join contract. Contract has address whitelisting enabled and address is not part of the list");
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(false);
      await escrow.connect(wallet2).adhereToContract(1, 100);
      expect(await escrow.connect(wallet2).isCallerInvolvedInContract(1)).to.equal(true);
    });
  })
})