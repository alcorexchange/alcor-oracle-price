const {
  Chain,
  Asset,
  expectAction,
  expectThrow,
  expectBalance,
} = require('qtest-js');
const {
  encodePriceSqrt,
  TICK_SPACINGS,
  FeeAmount,
  getMaxLiquidityPerTick,
  MaxUint64,
  MaxUint128,
  expandTo18Decimals,
  getMinTick,
  getMaxTick,
} = require('./utilities.js');
const { BigNumber } = require('ethers');
const Decimal = require('decimal.js');
const { Token, CurrencyAmount } = require('@alcorexchange/alcor-swap-sdk');

describe('alcorswap integration ticks, positions, collected fees test', () => {
  let chain;
  let alcorswap,
    alcorswap_interface,
    bob,
    contract1,
    contract2,
    swapper1,
    swapper2;

  afterAll(async () => {
    await chain.clear();
  }, 10000);

  beforeAll(async () => {
    chain = await Chain.setupChain('EOS');
    [alcorswap_interface, bob, contract1, contract2, swapper1, swapper2] =
      chain.accounts;
    alcorswap = await chain.system.createAccount(
      'swap.alcor',
      chain.coreSymbol.convertAssetString(1000),
      4 * 1024 * 1024
    );

    await alcorswap.setContract({
      abi: './tests/artifacts/alcorswap.abi',
      wasm: './tests/artifacts/alcorswap.wasm',
    });

    await alcorswap.addCode('active');
    await alcorswap.contract.action.init({});

    await contract1.setContract({
      abi: './tests/artifacts/eosio.token.abi',
      wasm: './tests/artifacts/eosio.token.wasm',
    });
    await contract1.addCode('active');

    await contract2.setContract({
      abi: './tests/artifacts/eosio.token.abi',
      wasm: './tests/artifacts/eosio.token.wasm',
    });
    await contract2.addCode('active');

    await alcorswap_interface.setContract({
      abi: './build/alcorpriceoracle_test.abi',
      wasm: './build/alcorpriceoracle_test.wasm',
    });
  }, 100000);

  async function createPool(
    alcorContract,
    account,
    tokenA,
    tokenB,
    sqrtPriceX64,
    fee
  ) {
    const [amountA, symbolA] = tokenA.quantity.split(' ');
    const [amountB, symbolB] = tokenB.quantity.split(' ');
    const [integerA, fractionalA] = amountA.split('.');
    const [integerB, fractionalB] = amountB.split('.');
    const receipt = await alcorContract.contract.action.createpool(
      {
        account: account.name,
        tokenA,
        tokenB,
        sqrtPriceX64,
        fee,
      },
      [{ actor: account.name, permission: 'active' }]
    );

    const lastPool = await alcorContract.contract.table.pools.getLastRow({
      scope: alcorContract.name,
    });
    expect(lastPool.tokenA).toEqual(tokenA);
    expect(lastPool.tokenB).toEqual(tokenB);
    expect(lastPool.fee).toEqual(fee);
    expect(lastPool.tickSpacing).toEqual(TICK_SPACINGS.get(fee));
    expect(lastPool.maxLiquidityPerTick).toEqual(
      getMaxLiquidityPerTick(TICK_SPACINGS.get(fee)).toString()
    );

    expect(lastPool.currSlot.sqrtPriceX64).toEqual(sqrtPriceX64.toString());

    expect(lastPool.currSlot.currentObservationNum).toEqual(1);
    expect(lastPool.currSlot.maxObservationNum).toEqual(1);
    expect(lastPool.feeGrowthGlobalAX64).toEqual('0');
    expect(lastPool.feeGrowthGlobalBX64).toEqual('0');
    expect(lastPool.protocolFeeA).toEqual(
      (0).toFixed(fractionalA.length) + ' ' + symbolA
    );
    expect(lastPool.protocolFeeB).toEqual(
      (0).toFixed(fractionalB.length) + ' ' + symbolB
    );
    expect(lastPool.liquidity).toEqual(0);
    return lastPool;
  }

  async function addLiquid(
    alcorContract,
    poolId,
    owner,
    tokenADesired,
    tokenBDesired,
    tickLower,
    tickUpper,
    tokenAMin,
    tokenBMin,
    deadline
  ) {
    const receipt = await alcorContract.contract.action.addliquid(
      {
        poolId,
        owner: owner.name,
        tokenADesired,
        tokenBDesired,
        tickLower,
        tickUpper,
        tokenAMin,
        tokenBMin,
        deadline,
      },
      [{ actor: owner.name, permission: 'active' }]
    );
    await expectAction(
      receipt,
      alcorContract.name,
      'logmint',
      {
        owner: owner.name,
        poolId,
        tickLower: tickLower,
        tickUpper: tickUpper,
        // liquidity,
        // tokenA,
        // tokenB,
      },
      [{ actor: alcorContract.name, permission: 'active' }]
    );
  }

  async function subLiquid(
    alcorContract,
    poolId,
    owner,
    liquidity,
    tickLower,
    tickUpper,
    tokenAMin,
    tokenBMin,
    deadline,
    isUpdateFee = false
  ) {
    const receipt = await alcorContract.contract.action.subliquid(
      {
        poolId,
        owner: owner.name,
        liquidity,
        tickLower,
        tickUpper,
        tokenAMin,
        tokenBMin,
        deadline,
      },
      [{ actor: owner.name, permission: 'active' }]
    );
    if (!isUpdateFee) {
      await expectAction(
        receipt,
        alcorContract.name,
        'logburn',
        {
          owner: owner.name,
          poolId,
          tickLower: tickLower,
          tickUpper: tickUpper,
          // liquidity,
          // tokenA,
          // tokenB,
        },
        [{ actor: alcorContract.name, permission: 'active' }]
      );
    }
    return receipt;
  }

  async function createToken(tokenAccount, maximumSupply) {
    await tokenAccount.contract.action.create(
      {
        issuer: tokenAccount.name,
        maximum_supply: maximumSupply,
      },
      [{ actor: tokenAccount.name, permission: 'active' }]
    );

    await tokenAccount.contract.action.issue(
      {
        to: tokenAccount.name,
        quantity: maximumSupply,
        memo: 'issue',
      },
      [{ actor: tokenAccount.name, permission: 'active' }]
    );
  }

  async function transferToken(
    tokenAccount,
    fromAccount,
    toAccount,
    quantity,
    memo
  ) {
    return tokenAccount.contract.action.transfer(
      {
        from: fromAccount.name,
        to: toAccount.name,
        quantity: quantity,
        memo,
      },
      [{ actor: fromAccount.name, permission: 'active' }]
    );
  }

  async function balanceOf(tokenAccount, user, sym) {
    const balances = await tokenAccount.contract.table.accounts.getRows({
      scope: user.name,
    });
    let balance = 0;
    const filteredBalances = balances.filter((row) => {
      const [amount, symbol] = row.balance.split(' ');
      if (symbol === sym) {
        balance = amount.replace('.', '');
        return symbol === sym;
      }
    });
    return balance;
  }

  function buildMemo(
    serviceName,
    poolId,
    accountName,
    contractName,
    asset,
    dealine
  ) {
    return `${serviceName}#${poolId}#${accountName}#${asset}@${contractName}#${dealine}`;
  }

  describe('get twap price test', function () {
    beforeAll(async () => {
      this.tokenC = new Token(contract1.name, 4, 'C');
      this.tokenD = new Token(contract2.name, 4, 'D');
      await createToken(contract1, '461168601842738.7903 C');
      await createToken(contract2, '461168601842738.7903 D');

      const tokenC = { contract: contract1.name, quantity: '0.0000 C' };
      const tokenD = { contract: contract2.name, quantity: '0.0000 D' };

      this.lastPool = await createPool(
        alcorswap,
        bob,
        tokenC,
        tokenD,
        '18446744073709551616',
        FeeAmount.MEDIUM
      );

      // bob provide liquidity
      await transferToken(contract1, contract1, bob, '50000.0000 C', 'issue');
      await transferToken(contract2, contract2, bob, '50000.0000 D', 'issue');

      await transferToken(contract1, bob, alcorswap, '50000.0000 C', 'deposit');
      await transferToken(contract2, bob, alcorswap, '50000.0000 D', 'deposit');
      await addLiquid(
        alcorswap,
        this.lastPool.id,
        bob,
        '50000.0000 C',
        '50000.0000 D',
        getMinTick(TICK_SPACINGS.get(FeeAmount.MEDIUM)),
        getMaxTick(TICK_SPACINGS.get(FeeAmount.MEDIUM)),
        '0.0000 C',
        '0.0000 D',
        0
      );

      const updatedPool = await alcorswap.contract.table.pools.getRows({
        scope: alcorswap.name,
        lower_bound: this.lastPool.id,
        upper_bound: this.lastPool.id,
      });
      this.Pool = updatedPool[0];
    });

    it('throw if older than oldest price', async () => {
      let receipt = await alcorswap_interface.contract.action.getprice({
        poolId: this.lastPool.id,
        twapInterval: 0,
      });
      let currentPrice = receipt.processed.action_traces[0].return_value_data;
      expect(currentPrice).toEqual('18446744073709551616'); // 2^64

      await expect(
        alcorswap_interface.contract.action.getprice({
          poolId: this.lastPool.id,
          twapInterval: 10,
        })
      ).rejects.toThrowError('GreatThanOldestObservation');
    });
    it('get current twap price', async () => {
      let receipt = await alcorswap_interface.contract.action.getprice({
        poolId: this.lastPool.id,
        twapInterval: 0,
      });
      let currentPrice = receipt.processed.action_traces[0].return_value_data;
      expect(currentPrice).toEqual('18446744073709551616'); // 2^64
    });
  });
});
