const { expect } = require("chai");

describe('Staking', function () {
  beforeEach(async function() {
    [owner, wallet1, wallet2] = await ethers.getSigners();

    Staking = await ethers.getContractFactory('Staking', owner);
    Wbtc = await ethers.getContractFactory('Wbtc', wallet1);
    staking = await Staking.deploy();
    wbtc = await Wbtc.deploy();

    wbtc.connect(wallet1).transfer(wallet2.address, 1000);

    await wbtc.connect(wallet1).approve(
      staking.address,
      4000
    );
    await wbtc.connect(wallet2).approve(
      staking.address,
      1000
    );

    WBTC = ethers.utils.formatBytes32String('Wbtc');
    await staking.whitelistToken(
      WBTC,
      wbtc.address
    );
  });

  describe('deployment', function () {
    it('should mint tokens to wallet 1', async function () {
      expect(await wbtc.balanceOf(wallet1.address)).to.equal(4000);
    })

    it('should transfer tokens to wallet 2', async function () {
      expect(await wbtc.balanceOf(wallet2.address)).to.equal(1000);
    })

    it('should whitelist wbtc on the contract', async function () {
      expect(
        await staking.whitelistedTokens(WBTC)
      ).to.equal(wbtc.address);
    })
  })

  describe('depositTokens', function () {
    it('should deposit wbtc', async function () {
      await staking.connect(wallet1).depositTokens(
        100,
        WBTC,
      );
      await staking.connect(wallet2).depositTokens(
        50,
        WBTC,
      );

      expect(await wbtc.balanceOf(wallet1.address)).to.equal(3900);
      expect(await wbtc.balanceOf(wallet2.address)).to.equal(950);

      expect(
        await staking.accountBalances(wallet1.address, WBTC)
      ).to.equal(100);
      expect(
        await staking.accountBalances(wallet2.address, WBTC)
      ).to.equal(50);
    });
  })

  describe('withdraw', function () {
    it('should withdraw wbtc from the contract', async function () {
      await staking.connect(wallet1).depositTokens(
        600,
        WBTC,
      );
      await staking.connect(wallet1).withdrawTokens(
        100,
        WBTC,
      );

      expect(await wbtc.balanceOf(wallet1.address)).to.equal(3500);
      expect(
        await staking.accountBalances(wallet1.address, WBTC)
      ).to.equal(500);
    })

    it('should not allow withdrawing more than has been deposited', async function () {
      await expect(
        staking.connect(wallet1).withdrawTokens(10000, WBTC)
      ).to.be.revertedWith("Insufficent funds")
    })
  })
})