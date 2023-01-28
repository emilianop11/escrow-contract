//USDC 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

const main = async () => {
  AnyToken = await ethers.getContractFactory('Any');
  anyToken = await AnyToken.deploy();
  await anyToken.deployed();
  console.log('Token Address:', anyToken.address);

  Escrow = await ethers.getContractFactory('Escrow');
  escrow = await Escrow.deploy(anyToken.address);
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