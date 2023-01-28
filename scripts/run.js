const {ParseSolidityStruct} = require("solidity-struct-parser");

const main = async () => {
    const [owner, wallet1, wallet2, wallet3] = await hre.ethers.getSigners();

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

    txn = await escrow.connect(wallet1).createContract(2, [], 1);
    await txn.wait();

    txn = await escrow.connect(wallet2).adhereToContract(1, 100)
    await txn.wait();
    txn = await escrow.connect(wallet3).adhereToContract(1, 100)
    await txn.wait();
  
    rsp = await escrow.connect(wallet3).getContractsForAddress();
    console.log(JSON.stringify(ParseSolidityStruct(rsp), null, 2))
};

const runMain = async () => {
    try {
        await main();
        process.exit(0);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

runMain();