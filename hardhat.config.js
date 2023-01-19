require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    matic: {
      chainId: 137,
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.OWNER_PRIVATE_KEY]
    }
  }
};
