//USDC 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

const main = async () => {
  Escrow = await ethers.getContractFactory('Escrow');
  escrow = await Escrow.deploy("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  await escrow.deployed();
  console.log('Escrow Address:', escrow.address);
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