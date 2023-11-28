# Escrow

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
npx hardhat run scripts/deploy.js --network matic

// deploy locally
npx hardhat run --network localhost scripts/deployLocallyToTestFiume.js
```

IMPORTANT: ALWAYS REMEMBER TO UPDATE THE ABI IN FIUME AFTER DEPLOYMENT OF THIS CONTRACT


mainnet = polygon

2 febrero 2023 (v1): mainnet 0x5091dDf964b1cad7a3b60147D540Fe5a196D4071 
Deployed commit 95e3d438d604474f3d707e830bed3c66fd3c71c7

// 12 abril 2023 (v1): mainnet 0x5Ede2EA43B94a2dCa3AC413e3f2F37A4f65d48e5 
Deployed commit f15f115ee6077f81f820feb6eea7814360bb01aa

create contract 627,654 gas
sign contract 205,608 gas (another run was 168,426 gas. idk)
approve release 54,798 gas (another run was 55,461 gas)
withdraw 146,293 gas

// 28 nov 2023 (v2) mainnet 0x5EDC34F0b49efe2DDC06905FE71Bcd82962fA6eD
Deployed commit fd34c87734aaee8cc9ee5031804b4d04db307454