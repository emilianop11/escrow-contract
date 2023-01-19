//USDC 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

const main = async () => {
  const helperContractFactory = await hre.ethers.getContractFactory('Helper');
  const helperContract = await helperContractFactory.deploy("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
  await helperContract.deployed();
  console.log('Contract Address:', helperContract.address);
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