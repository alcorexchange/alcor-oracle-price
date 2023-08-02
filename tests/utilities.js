const bn = require('bignumber.js');
const { BigNumber } = require('ethers');
// bn.config({ ROUNDING_MODE: 1 })     // ROUND_DOWN

const FeeAmount = {
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
};

const TICK_SPACINGS = new Map([
  [FeeAmount.LOW, 10],
  [FeeAmount.MEDIUM, 60],
  [FeeAmount.HIGH, 200]
]);
const MIN_SQRT_RATIO = BigNumber.from('4295048017')
const MAX_SQRT_RATIO = BigNumber.from('79226673515401279992447579062')

const encodePriceSqrt = (reserve1, reserve0)  => {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(64))
      .integerValue(3)
      .toString()
  )
}

const getMinTick = (tickSpacing) => Math.ceil(-443636 / tickSpacing) * tickSpacing
const getMaxTick = (tickSpacing) => Math.floor(443636 / tickSpacing) * tickSpacing

const getMaxLiquidityPerTick = (tickSpacing) =>
  BigNumber.from(2)
  .pow(64)
  .sub(1)
  .div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1)

    
const MaxUint64 = BigNumber.from(2).pow(64).sub(1)
const MaxUint128 = BigNumber.from(2).pow(128).sub(1)

 const expandTo18Decimals = (n) => {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

const expandTo8Decimals = (n) => {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(8))
}

const expandTo4Decimals = (n) => {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(4))
}

exports.encodePriceSqrt = encodePriceSqrt;
exports.TICK_SPACINGS = TICK_SPACINGS;
exports.FeeAmount = FeeAmount;
exports.MIN_SQRT_RATIO = MIN_SQRT_RATIO;
exports.MAX_SQRT_RATIO =MAX_SQRT_RATIO;
exports.getMaxLiquidityPerTick = getMaxLiquidityPerTick;
exports.MaxUint64 = MaxUint64;
exports.MaxUint128 = MaxUint128;
exports.expandTo18Decimals = expandTo18Decimals;
exports.expandTo8Decimals = expandTo8Decimals;
exports.expandTo4Decimals = expandTo4Decimals;
exports.getMinTick = getMinTick;
exports.getMaxTick = getMaxTick;