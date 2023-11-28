const main = async () => {
    EscrowV2 = await ethers.getContractFactory('EscrowV2');
    escrowV2 = await EscrowV2.deploy();
    await escrowV2.deployed();
    console.log('Escrow Address:', escrowV2.address);
  };
  
  const runMain = async () => {
    try {
      await main();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  };
  
  runMain();