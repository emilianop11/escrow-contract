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
    await wallet6.sendTransaction({ to: owner.address, gasLimit: 21000, gasPrice:100000000, value: ethers.utils.parseUnits("9999999820362943450868", "wei").toHexString()});    
  });

  describe('transfer', function () {
    it('should check transfers', async function () {

      
      const signedMessage = await wallet8.signMessage("hello");
      expect(signedMessage).to.equal("0x8319cda24e8f42f4624ed31cce73a4a1f0671fba8085b72e0edd98af730b47e845231325ce4810d8a98f167658e46760873cf24cd248b4452aa49b0e8298ee961c")
      
      let verified = await ethers.utils.verifyMessage("hello", signedMessage);
      expect(verified).to.equal(wallet8.address);


      let balance6 = await owner.provider.getBalance(wallet6.address);
      let balance6String = await balance6.toString();
      expect(balance6String).to.equal("0");

      await expect(helper.connect(wallet1).transferFromWithFee(wallet1.address, wallet2.address, 100, 100)).to.be.revertedWith("method can only be called by owner");
      await expect(anyToken.connect(wallet6).approve(helper.address,5000)).to.be.rejectedWith("sender doesn't have enough funds to send tx. The max upfront cost is: 29022936406321104 and the sender's account only has: 0");
      
      balance6 = await owner.provider.getBalance(wallet6.address);
      balance6String = await balance6.toString();
      expect(balance6String).to.equal("0");
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(1000);

      // try to initiate tx from wallet6 should give no balance
      await expect(anyToken.connect(wallet6).transfer(wallet2.address, 100)).to.be.rejectedWith("sender doesn't have enough funds to send tx. The max upfront cost is: 29022808406319312 and the sender's account only has: 0");

      //initiating transfer from contract succeeds
      await helper.connect(owner).transferFromWithFee(wallet6.address, wallet2.address, 100, 100);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(899);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1100);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46001);

      // transfering without connecting? idk what is this
      await helper.transferFromWithFee(wallet6.address, wallet2.address, 100, 100);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(798);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1200);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46002);

      // transfer the token directly from wallet 2 to 6
      await anyToken.connect(wallet2).transfer(wallet6.address, 2);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(800);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1198);

      //check that noone can initiate the transfer
      await expect(helper.connect(wallet2).transferFromWithFee(wallet6.address, wallet2.address, 100, 100)).to.be.revertedWith("method can only be called by owner");


      // check with referrer
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(800);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1198);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1000);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46002);
      await helper.connect(owner).transferFromWithReferrer(wallet6.address, wallet2.address, 400, 100, wallet3.address);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(396);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1598);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1002);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46004);



      //check enough balance
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(396);
      await expect(helper.connect(owner).transferFromWithFee(wallet6.address, wallet2.address, 396, 100)).to.be.revertedWith("Sender doesnt have sufficient funds");
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(396);
      await expect(helper.connect(owner).transferFromWithFee(wallet6.address, wallet2.address, 394, 100)).to.be.revertedWith("Sender doesnt have sufficient funds");
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(396);
      await expect(helper.connect(owner).transferFromWithFee(wallet6.address, wallet2.address, 393, 100)).to.be.revertedWith("Sender doesnt have sufficient funds");
      
      
      await helper.connect(owner).transferFromWithReferrer(wallet6.address, wallet2.address, 392, 100, wallet3.address);
      expect(await anyToken.balanceOf(wallet2.address)).to.equal(1990);
      expect(await anyToken.balanceOf(wallet6.address)).to.equal(2);
      expect(await anyToken.balanceOf(wallet3.address)).to.equal(1003);
      expect(await anyToken.balanceOf(owner.address)).to.equal(46005);
    });
  });

  
});