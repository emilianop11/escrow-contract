const { expect } = require("chai");

describe('Helper', function () {
  beforeEach(async function() {
    [owner, wallet1, wallet2, wallet4, wallet5, wallet6, wallet7, wallet8] = await ethers.getSigners();

    
    AnyToken = await ethers.getContractFactory('Any', owner);
    anyToken = await AnyToken.deploy();
    Helper = await ethers.getContractFactory('Helper', owner);
    helper = await Helper.deploy(anyToken.address);
    anyToken.connect(owner).transfer(wallet1.address, 1000);
    anyToken.connect(owner).transfer(wallet2.address, 1000);
    anyToken.connect(owner).transfer(wallet3.address, 1000);
    anyToken.connect(owner).transfer(wallet6.address, 1000);

    await anyToken.connect(wallet6).approve(helper.address, 5000);                                                                                                                                                         
    await wallet6.sendTransaction({ to: owner.address, gasLimit: 21000, gasPrice:100000000, value: ethers.utils.parseUnits("9999999820248358429998", "wei").toHexString()});    
  });

  describe('transfer', function () {
    it('should check transfers', async function () {
      let balance6 = await owner.provider.getBalance(wallet6.address);
      let balance6String = await balance6.toString();
      expect(balance6String).to.equal("0");

      await expect(helper.connect(wallet1).transferFromTo(wallet1.address, wallet2.address, 100)).to.be.revertedWith("method can only be called by owner");
      await expect(anyToken.connect(wallet6).approve(helper.address,5000)).to.be.rejectedWith("sender doesn't have enough funds to send tx. The max upfront cost is: 29022936406321104 and the sender's account only has: 0");
      
      balance6 = await owner.provider.getBalance(wallet6.address);
      balance6String = await balance6.toString();
      expect(balance6String).to.equal("0");
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(1000);

      // try to initiate tx from wallet6 should give no balance
      await expect(anyToken.connect(wallet6).transfer(wallet2.address, 100)).to.be.rejectedWith("sender doesn't have enough funds to send tx. The max upfront cost is: 29022808406319312 and the sender's account only has: 0");

      //initiating transfer from contract succeeds
      await helper.connect(owner).transferFromTo(wallet6.address, wallet2.address, 100);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(899);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1100);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46001);
      //await expect(helper.connect(owner).transferFromTo(wallet6.address, wallet2.address, 100)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });
});