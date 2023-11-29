const { expect } = require("chai");

describe("EscrowV2", function () {
  let EscrowV2, escrowV2;
  let owner, wallet1, wallet2, wallet3, walletHacker;
  let AnyToken, anyToken;
  let title, description;

  beforeEach(async function() {
    [owner, wallet1, wallet2, wallet3, walletHacker] = await ethers.getSigners();
    AnyToken = await ethers.getContractFactory('Any', owner);
    anyToken = await AnyToken.deploy();
    EscrowV2 = await ethers.getContractFactory('EscrowV2', owner);
    escrowV2 = await EscrowV2.deploy(); // Deployed without any arguments
    title = "Sample Contract Title";
    description = "This is a sample contract description.";

    // Transfer some tokens to wallet1 and wallet2 for testing
    await anyToken.connect(owner).transfer(wallet1.address, 1000);
    await anyToken.connect(owner).transfer(wallet2.address, 1000);
    await anyToken.connect(owner).transfer(wallet3.address, 1000);

    // Approve the EscrowV2 to spend tokens on behalf of wallet1 and wallet2
    await anyToken.connect(wallet1).approve(escrowV2.address, 500);
    await anyToken.connect(wallet2).approve(escrowV2.address, 500);
    await anyToken.connect(wallet3).approve(escrowV2.address, 500);
  });

  it("should create a new contract with valid parameters", async function () {
    const participants = [
      { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
      { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
    ];

    // Fetch the current block timestamp and add 600 seconds (10 minutes)
    const currentBlockTime = (await ethers.provider.getBlock('latest')).timestamp;
    const unlockTime = currentBlockTime + 600; // 10 minutes from now

    const unlockAtCreationState = true;

    await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, unlockAtCreationState);

    const createdContract = await escrowV2.contracts(0);
    expect(createdContract.unlockTime).to.equal(unlockTime);
    expect(createdContract.warrantyTokenAddress).to.equal(anyToken.address);
    expect(createdContract.unlockAtCreationState).to.equal(unlockAtCreationState);
  });

  it("should fail when createContract is called with an invalid ERC20 token address", async function () {
    const title = "Invalid ERC20 Test Contract";
    const description = "This contract uses an invalid ERC20 token address";
    const participants = [
      { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
      { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
    ];
    const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
    
    // Use an invalid ERC20 token address (e.g., the zero address)
    const invalidTokenAddress = "0x0000000000000000000000000000000000000000";
    
    // Expect the transaction to revert
    await expect(
      escrowV2.createContract(title, description, participants, unlockTime, invalidTokenAddress, true)
    ).to.be.revertedWith("Invalid ERC20 token address");
  });

  it("should fail to create a new contract if the total amounts to lock and withdraw are not equal", async function () {
    const participants = [
      { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 150 },
      { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
    ];
    const unlockTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
    const unlockAtCreationState = true;

    let transactionFailed = false;

    try {
      await escrowV2.createContract(title, description, title, description, participants, unlockTime, anyToken.address, unlockAtCreationState);
    } catch (error) {
      transactionFailed = true;
    }

    expect(transactionFailed).to.equal(true, "Transaction should fail when lock and withdraw amounts are not equal");
  });

  it("should fail to create a new contract with unlock time in the past", async function () {
    const participants = [
      { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
      { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
    ];
    const unlockTime = Math.floor(Date.now() / 1000) - 600; // 10 minutes in the past
    const unlockAtCreationState = true;

    let transactionFailed = false;
    try {
      await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, unlockAtCreationState);
    } catch (error) {
      transactionFailed = true;
    }

    expect(transactionFailed).to.equal(true, "Transaction should fail when unlock time is in the past");
  });

    it("should fail to create a new contract with less than two participants", async function () {
        const participants = [
        { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 }
        ];
        const unlockTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
        const unlockAtCreationState = true;

        let transactionFailed = false;
        try {
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, unlockAtCreationState);
        } catch (error) {
        transactionFailed = true;
        }

        expect(transactionFailed).to.equal(true, "Transaction should fail with less than two participants");
    });

    it("should fail when a non-participant tries to adhere to the contract", async function () {
        // Setup a contract with specific participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600; // 10 minutes from now
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        // Attempt by a non-participant (walletHacker) to adhere to the contract
        let transactionFailed = false;
        try {
          await escrowV2.connect(walletHacker).adhereToContract(0);
        } catch (error) {
          transactionFailed = true;
        }
    
        expect(transactionFailed).to.equal(true, "Non-participant should not be able to adhere to the contract");
      });
    
      it("should allow a participant to adhere to the contract successfully", async function () {
        // Setup a contract and adhere as a participant
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        await escrowV2.connect(wallet1).adhereToContract(0);
    
        // Further assertions can be added to verify adherence
      });
    
      it("should allow a participant to withdraw their deposit if the other participant has not adhered", async function () {
        // Setup a contract and adhere as one participant
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        await escrowV2.connect(wallet1).adhereToContract(0);
    
        // Attempt to withdraw the deposit by the participant who adhered
        let transactionFailed = false;
        try {
          await escrowV2.connect(wallet1).withdrawFromContract(0);
        } catch (error) {
          transactionFailed = true;
        }
    
        expect(transactionFailed).to.equal(false, "Participant should be able to withdraw their deposit if the other participant has not adhered");
      });

      it("should lock the contract after both participants adhere", async function () {
        // Setup and adhere by both participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
    
        const createdContract = await escrowV2.contracts(0);
        expect(createdContract.isLocked).to.equal(true);
      });
    
      it("should not allow withdrawal if not all participants have approved and unlockTime hasn't elapsed", async function () {
        // Setup contract and adhere by both participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 100 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 200 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
    
        // Attempt withdrawal by one participant without both approving
        let transactionFailed = false;
        try {
          await escrowV2.connect(wallet1).withdrawFromContract(0);
        } catch (error) {
          transactionFailed = true;
        }
    
        expect(transactionFailed).to.equal(true, "Withdrawal should fail if not all participants have approved and unlockTime hasn't elapsed");
      });

      it("should allow withdrawal of configured amounts after all participants approved unlock and check ERC20 token balances", async function () {
        // Setup contract and adhere by both participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        // Record ERC20 balances before adherence
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const initialBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
    
        // Wallets adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
    
        // Check ERC20 balances after adherence
        const postAdherenceBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const postAdherenceBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
    
        expect(initialBalanceWallet1.sub(postAdherenceBalanceWallet1)).to.equal(100, "Wallet1 balance should decrease by 100 after adherence");
        expect(initialBalanceWallet2.sub(postAdherenceBalanceWallet2)).to.equal(200, "Wallet2 balance should decrease by 200 after adherence");
    
        // Approve and withdraw from contract
        await escrowV2.connect(wallet1).approveUnlock(0);
        await escrowV2.connect(wallet2).approveUnlock(0);
        await escrowV2.connect(wallet1).withdrawFromContract(0);
        await escrowV2.connect(wallet2).withdrawFromContract(0);
    
        // Record ERC20 balances after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const finalBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
    
        // Check ERC20 balances after withdrawal
        expect(finalBalanceWallet1).to.equal(950, "Wallet1 balance should decrease by 50 after withdrawal");
        expect(finalBalanceWallet2).to.equal(1050, "Wallet2 balance should increase by 50 after withdrawal");
      });
    
      it("should not change ERC20 token balance for a participant who attempts to withdraw before adhering", async function () {
        // Setup contract with participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        // Wallet1 adheres to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
    
        // Record ERC20 balance of wallet2 before attempting withdrawal
        const initialBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
    
        // Wallet2 attempts to withdraw from the contract before adhering
        await escrowV2.connect(wallet2).withdrawFromContract(0); // No need to catch an error as we expect no failure
    
        // Check ERC20 balance of wallet2 after the attempted withdrawal
        const finalBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
    
        expect(finalBalanceWallet2).to.equal(initialBalanceWallet2, "Wallet2's ERC20 token balance should not change");
      });

      it("should allow withdrawal of configured amount after unlockTime with unlockAtCreationState false", async function () {
        // Setup contract with unlockAtCreationState false
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, false);
      
        // Both wallets adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
      
        // Record ERC20 balances before withdrawal
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const initialBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
      
        // Simulate time passing to surpass unlockTime
        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');
      
        // Perform withdrawals
        await escrowV2.connect(wallet1).withdrawFromContract(0);
        await escrowV2.connect(wallet2).withdrawFromContract(0);
      
        // Check ERC20 balances after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const finalBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
      
        expect(finalBalanceWallet1.sub(initialBalanceWallet1)).to.equal(50, "Wallet1 balance should increase by 50");
        expect(finalBalanceWallet2.sub(initialBalanceWallet2)).to.equal(250, "Wallet2 balance should increase by 250");
      });

      it("should allow withdrawal of deposited amount after unlockTime with unlockAtCreationState true", async function () {
        // Setup contract with unlockAtCreationState true
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
      
        // Both wallets adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
      
        // Record ERC20 balances before withdrawal
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const initialBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
      
        // Simulate time passing to surpass unlockTime
        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');
      
        // Perform withdrawals
        await escrowV2.connect(wallet1).withdrawFromContract(0);
        await escrowV2.connect(wallet2).withdrawFromContract(0);
      
        // Check ERC20 balances after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const finalBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
      
        expect(finalBalanceWallet1.sub(initialBalanceWallet1)).to.equal(100, "Wallet1 balance should increase by 100");
        expect(finalBalanceWallet2.sub(initialBalanceWallet2)).to.equal(200, "Wallet2 balance should increase by 200");
      });
      
      it("should allow withdrawal of deposited amount after unlockTime with only one participant adhering (unlockAtCreationState false)", async function () {
        // Setup contract with unlockAtCreationState false
        // Similar setup as above but with unlockAtCreationState set to false
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, false);
      
        // Wallet1 adheres to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
      
        // Simulate time passing to surpass unlockTime
        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');
      
        // Record ERC20 balance before withdrawal
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
      
        // Perform withdrawal
        await escrowV2.connect(wallet1).withdrawFromContract(0);
      
        // Check ERC20 balance after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
      
        expect(finalBalanceWallet1.sub(initialBalanceWallet1)).to.equal(100, "Wallet1 balance should increase by 100");
      });

      it("should allow withdrawal of deposited amount after unlockTime with only one participant adhering (unlockAtCreationState true)", async function () {
        // Setup contract with unlockAtCreationState true
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
      
        // Wallet1 adheres to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
      
        // Simulate time passing to surpass unlockTime
        await ethers.provider.send('evm_increaseTime', [601]);
        await ethers.provider.send('evm_mine');
      
        // Record ERC20 balance before withdrawal
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
      
        // Perform withdrawal
        await escrowV2.connect(wallet1).withdrawFromContract(0);
      
        // Check ERC20 balance after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
      
        expect(finalBalanceWallet1.sub(initialBalanceWallet1)).to.equal(100, "Wallet1 balance should increase by 100");
      });

      it("should allow adherence, approval, and withdrawal for three addresses and check balances", async function () {
        // Setup contract with three participants
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 50 },
          { addr: wallet3.address, amountToLock: 300, amountToWithdraw: 500 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
    
        // Record ERC20 balances before adherence
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const initialBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
        const initialBalanceWallet3 = await anyToken.balanceOf(wallet3.address);
    
        // All wallets adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);
        await escrowV2.connect(wallet3).adhereToContract(0);
    
        // Check ERC20 balances after adherence
        const postAdherenceBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const postAdherenceBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
        const postAdherenceBalanceWallet3 = await anyToken.balanceOf(wallet3.address);
    
        // All wallets approve unlock
        await escrowV2.connect(wallet1).approveUnlock(0);
        await escrowV2.connect(wallet2).approveUnlock(0);
        await escrowV2.connect(wallet3).approveUnlock(0);
    
        // Perform withdrawals
        await escrowV2.connect(wallet1).withdrawFromContract(0);
        await escrowV2.connect(wallet2).withdrawFromContract(0);
        await escrowV2.connect(wallet3).withdrawFromContract(0);
    
        // Check ERC20 balances after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);
        const finalBalanceWallet2 = await anyToken.balanceOf(wallet2.address);
        const finalBalanceWallet3 = await anyToken.balanceOf(wallet3.address);
    
        // Assertions
        expect(postAdherenceBalanceWallet1).to.equal(900, "Wallet1 balance should decrease by 100 after adherence");
        expect(postAdherenceBalanceWallet2).to.equal(800, "Wallet2 balance should decrease by 200 after adherence");
        expect(postAdherenceBalanceWallet3).to.equal(700, "Wallet3 balance should decrease by 300 after adherence");
    
        expect(finalBalanceWallet1).to.equal(950, "Wallet1 balance should increase by 50 after withdrawal");
        expect(finalBalanceWallet2).to.equal(850, "Wallet2 balance should increase by 50 after withdrawal");
        expect(finalBalanceWallet3).to.equal(1200, "Wallet3 balance should increase by 500 after withdrawal");
      });

      it("should handle the case where amountToWithdraw is 0 for a participant", async function () {
        // Setup contract with a participant having amountToWithdraw as 0
        const participants = [
          { addr: wallet1.address, amountToLock: 250, amountToWithdraw: 0 },
          { addr: wallet2.address, amountToLock: 50, amountToWithdraw: 300 } // Adjusted to match total lock amount
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);


        // Record ERC20 balance before withdrawal
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);

        // Wallet1 and Wallet2 adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);

        // Check ERC20 balance after adherence
        const postAdherenceBalanceWallet1 = await anyToken.balanceOf(wallet1.address);

        // All wallets approve unlock
        await escrowV2.connect(wallet1).approveUnlock(0);
        await escrowV2.connect(wallet2).approveUnlock(0);

        // Perform withdrawals
        await escrowV2.connect(wallet1).withdrawFromContract(0);

        // Check ERC20 balance after withdrawal
        const finalBalanceWallet1 = await anyToken.balanceOf(wallet1.address);

        // Assert that wallet1's balance decreases by the lock amount after adherence
        expect(initialBalanceWallet1.sub(postAdherenceBalanceWallet1)).to.equal(250, "Wallet1 balance should decrease by 250 after adherence");

        // Assert that wallet1's balance remains the same after withdrawal since amountToWithdraw is 0
        expect(finalBalanceWallet1).to.equal(postAdherenceBalanceWallet1, "Wallet1 balance should remain unchanged after withdrawal");
      });

      it("should handle the case where amountToLock is 0 for a participant with matching total withdraw amount", async function () {
        // Setup contract with matching total lock and withdraw amounts
        const participants = [
          { addr: wallet1.address, amountToLock: 0, amountToWithdraw: 250 }, // Adjusted to match total withdrawal
          { addr: wallet2.address, amountToLock: 300, amountToWithdraw: 50 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);

        // Record ERC20 balance before adherence
        const initialBalanceWallet1 = await anyToken.balanceOf(wallet1.address);

        // Wallet1 and Wallet2 adhere to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);
        await escrowV2.connect(wallet2).adhereToContract(0);

        // Check ERC20 balance after adherence
        const postAdherenceBalanceWallet1 = await anyToken.balanceOf(wallet1.address);

        // Assert that wallet1's balance remains the same since amountToLock is 0
        expect(postAdherenceBalanceWallet1).to.equal(initialBalanceWallet1, "Wallet1 balance should remain unchanged after adherence");
      });

      it("should return the contract structure for a participating address", async function () {
        // Create a contract
        const title = "Test Contract";
        const description = "A test contract";
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
      
        // Call getContractsForParticipant for wallet1
        const contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
      
        // Check that the returned array contains the created contract
        expect(contractsForWallet1.length).to.equal(1);
        expect(contractsForWallet1[0].title).to.equal(title);
        expect(contractsForWallet1[0].description).to.equal(description);
        // ... add other assertions as necessary to check the contract structure ...
      });

      it("should return the contract structure for a participating address", async function () {
        // Create a contract
        const title = "Test Contract";
        const description = "A test contract";
        const participants = [
          { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
          { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);
      
        const contractsForWallet3 = await escrowV2.getContractsForParticipant(wallet3.address);

        // Check that the returned array is empty
         expect(contractsForWallet3.length).to.equal(0);
      });
      
      
      it("should prevent a participant from withdrawing more than once", async function () {
        // Setup contract with participants
        const title = "Test Contract";
        const description = "A test contract for multiple withdrawal prevention";
        const participants = [
            { addr: wallet1.address, amountToLock: 250, amountToWithdraw: 250 },
            { addr: wallet2.address, amountToLock: 250, amountToWithdraw: 250 }
        ];
        const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;

        await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);

        // Wallet1 adheres to the contract
        await escrowV2.connect(wallet1).adhereToContract(0);

        // Perform the first withdrawal
        await escrowV2.connect(wallet1).withdrawFromContract(0);

        // Attempt a second withdrawal and expect it to fail
        await expect(escrowV2.connect(wallet1).withdrawFromContract(0))
            .to.be.revertedWith("Participant has already withdrawn");
    });

    it("should prevent any participant from adhering after a withdrawal has been made", async function () {
      // Setup contract with participants
      const title = "Test Contract";
      const description = "A test contract for adherence prevention after withdrawal";
      const participants = [
          { addr: wallet1.address, amountToLock: 250, amountToWithdraw: 250 },
          { addr: wallet2.address, amountToLock: 250, amountToWithdraw: 250 }
      ];
      const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
      
      await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);

      // Wallet1 adheres to the contract
      await escrowV2.connect(wallet1).adhereToContract(0);

      // Wallet1 performs a withdrawal
      await escrowV2.connect(wallet1).withdrawFromContract(0);

      // Attempt to adhere to the contract by Wallet2 and expect it to fail
      await expect(escrowV2.connect(wallet2).adhereToContract(0))
          .to.be.revertedWith("Withdrawal has already occurred");
  });

  it("should prevent a participant from adhering twice to the same contract", async function () {
    // Setup contract with participants
    const title = "Test Contract";
    const description = "A test contract for double adherence prevention";
    const participants = [
        { addr: wallet1.address, amountToLock: 250, amountToWithdraw: 250 },
        { addr: wallet2.address, amountToLock: 250, amountToWithdraw: 250 }
    ];
    const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
    
    await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);

    // Wallet1 adheres to the contract
    await escrowV2.connect(wallet1).adhereToContract(0);

    // Attempt to adhere to the contract again by Wallet1 and expect it to fail
    await expect(escrowV2.connect(wallet1).adhereToContract(0))
        .to.be.revertedWith("Caller has already adhered");
});

it("should follow the happy path with intermediate checks using getContractsForParticipant", async function () {
  // Create a contract
  const title = "Happy Path Test";
  const description = "Testing the full contract lifecycle";
  const participants = [
      { addr: wallet1.address, amountToLock: 100, amountToWithdraw: 50 },
      { addr: wallet2.address, amountToLock: 200, amountToWithdraw: 250 }
  ];
  const unlockTime = (await ethers.provider.getBlock('latest')).timestamp + 600;
  await escrowV2.createContract(title, description, participants, unlockTime, anyToken.address, true);

  // Check initial state using getContractsForParticipant
  let contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
  expect(contractsForWallet1.length).to.equal(1);
  expect(contractsForWallet1[0].isLocked).to.equal(false);
  // ... additional assertions for initial state ...

  // Wallet1 adheres to the contract
  await escrowV2.connect(wallet1).adhereToContract(0);
  
  // Check state after Wallet1's adherence
  contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
  expect(contractsForWallet1[0].participants[0].hasAdhered).to.equal(true);
  // ... additional assertions for state after Wallet1's adherence ...

  // Wallet2 adheres to the contract
  await escrowV2.connect(wallet2).adhereToContract(0);

  // Check state after Wallet2's adherence
  contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
  expect(contractsForWallet1[0].isLocked).to.equal(true); // Assuming contract locks after all adhere
  // ... additional assertions for state after Wallet2's adherence ...

  // Both participants approve the unlock
  await escrowV2.connect(wallet1).approveUnlock(0);
  await escrowV2.connect(wallet2).approveUnlock(0);

  // Check state after approvals
  contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
  expect(contractsForWallet1[0].participants[0].hasApproved).to.equal(true);
  expect(contractsForWallet1[0].participants[1].hasApproved).to.equal(true);
  // ... additional assertions for state after approvals ...

  // Perform withdrawals
  await escrowV2.connect(wallet1).withdrawFromContract(0);
  await escrowV2.connect(wallet2).withdrawFromContract(0);

  // Check final state
  contractsForWallet1 = await escrowV2.getContractsForParticipant(wallet1.address);
  expect(contractsForWallet1[0].participants[0].hasWithdrawn).to.equal(true);
  expect(contractsForWallet1[0].participants[1].hasWithdrawn).to.equal(true);
  // ... additional assertions for final state ...
});

  // Additional tests to cover other scenarios and edge cases
});
