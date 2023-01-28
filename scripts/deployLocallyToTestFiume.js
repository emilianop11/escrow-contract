//USDC 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

const main = async () => {

  const [owner, wallet1, wallet2, wallet3, wallet4 ] = await ethers.getSigners();
  console.log("owner address", owner.address)
  AnyToken = await ethers.getContractFactory('Any');
  anyToken = await AnyToken.deploy();
  await anyToken.deployed();
  console.log('Token Address:', anyToken.address);

  Escrow = await ethers.getContractFactory('Escrow');
  escrow = await Escrow.deploy(anyToken.address);
  await escrow.deployed();
  console.log('Escrow Address:', escrow.address);

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

  await escrow.connect(wallet1).createContract("Sample Contract", "A sample contract just to test the ui", 2, [], 1, { gasLimit: 2100000, gasPrice:1294948769,});
  await escrow.connect(wallet2).adhereToContract(1, 100, { gasLimit: 2100000, gasPrice:1294948769,});
  await escrow.connect(wallet3).adhereToContract(1, 100, { gasLimit: 2100000, gasPrice:1294948769,});

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