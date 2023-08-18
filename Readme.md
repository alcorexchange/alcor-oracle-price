# Smart Contract Example for Using Alcor Price Oracle On-Chain
## Build
```
$ eosio-cpp -I include -w --abigen ./src/alcorpriceoracle_test.cpp -o ./build/alcorpriceoracle_test.wasm

```

## Test
```
$ npm install
$ npm run test
```

## Formater && linter
```
# javascript prettier
$ npm run prettier

# C++ prettier
$ npm run linter
```

## On-Chain Price Oracle Guide
### Expanding Price Availability with RAM Purchase for WAX/USDT Pair
1. Retrieve Pool Information:
```
cleos -u http://wax.api.eosnation.io get table swap.alcor swap.alcor pools -L 1095 -U 1095
{
  "rows": [{
      "id": 1095,
      "active": 1,
      "tokenA": {
        "quantity": "267401.17536530 WAX",
        "contract": "eosio.token"
      },
      "tokenB": {
        "quantity": "4187.0761 USDT",
        "contract": "usdt.alcor"
      },
      "fee": 3000,
      "feeProtocol": 0,
      "tickSpacing": 60,
      "maxLiquidityPerTick": "1247497401346422",
      "currSlot": {
        "sqrtPriceX64": "36937981673168319",
        "tick": -124275,
        "lastObservationTimestamp": 1683360351,
        "currentObservationNum": 1,
        "maxObservationNum": 1
      },
      "feeGrowthGlobalAX64": "55932187406228279116",
      "feeGrowthGlobalBX64": "252978639947278",
      "protocolFeeA": "0.00000000 WAX",
      "protocolFeeB": "0.0000 USDT",
      "liquidity": "142304250737"
    }
  ]
}
```
1. Check Available Observations
Check the value of "maxObservationNum" in the pool details. For example, if "maxObservationNum": 1, it means that only the most recent second's price is being recorded for this PoolId.

1. Extending Price Availability
To increase the availability of price observations to cover the last 30 minutes, additional RAM needs to be purchased.
```
# RAM Required = 160 bytes * 30 minutes = 288kb .
# WAX Token = 0.4037 * 288 = 116.25725952 WAX (with RAM price is 0.4037 WAX per KB)
# Let's send 120 WAX

cleos -u http://wax.api.eosnation.iotransfer ammcontract1 swap.alcor "120.00000000 WAX"
 "addoraclerow#1095" -p ammcontract1
executed transaction: 66335abc5e0b8fd08caacce3d9e985a9d512842e5974bf90d5f0e930a716a488  144 bytes  653 us
#   eosio.token <= eosio.token::transfer        {"from":"ammcontract1","to":"swap.alcor","quantity":"120.00000000 WAX","memo":"addoraclerow#1095"}
#  ammcontract1 <= eosio.token::transfer        {"from":"ammcontract1","to":"swap.alcor","quantity":"120.00000000 WAX","memo":"addoraclerow#1095"}
#    swap.alcor <= eosio.token::transfer        {"from":"ammcontract1","to":"swap.alcor","quantity":"120.00000000 WAX","memo":"addoraclerow#1095"}
#         eosio <= eosio::buyram                {"payer":"swap.alcor","receiver":"swap.alcor","quant":"120.00000000 WAX"}
#    swap.alcor <= swap.alcor::addoraclerow     {"poolId":1095,"payer":"ammcontract1","previousRam":24111169}
#   eosio.token <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ram","quantity":"119.40000000 WAX","memo":"buy ram"}
#   eosio.token <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ramfee","quantity":"0.60000000 WAX","memo":"ram fee"}
#    swap.alcor <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ram","quantity":"119.40000000 WAX","memo":"buy ram"}
#     eosio.ram <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ram","quantity":"119.40000000 WAX","memo":"buy ram"}
#    swap.alcor <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ramfee","quantity":"0.60000000 WAX","memo":"ram fee"}
#  eosio.ramfee <= eosio.token::transfer        {"from":"swap.alcor","to":"eosio.ramfee","quantity":"0.60000000 WAX","memo":"ram fee"}
#    swap.alcor <= swap.alcor::logaddoracle     {"poolId":1095,"payer":"ammcontract1","rows":1893}
```
1. Checking Row Count:
- Once the new rows are added, check the number of rows for this PoolId to ensure the availability of observations for more than 30 minutes. With 1893 rows we can get more than 30 minutes observations

```
cleos -u http://wax.api.eosnation.io get table swap.alcor 1095 observations 
{
  "rows": [{
      "timestampInSec": 1692356485,
      "tickCumulative": -1096981718837,
      "secondsPerLiquidityCumulativeX64": "4964829441972068"
    },{
      "timestampInSec": 1692359906,
      "tickCumulative": -1097406863612,
      "secondsPerLiquidityCumulativeX64": "4965272902453039"
    },{
      "timestampInSec": 1692362289,
      "tickCumulative": -1097703030001,
      "secondsPerLiquidityCumulativeX64": "4965581808131541"
    },{
      "timestampInSec": 1692363197,
      "tickCumulative": -1097815879873,
      "secondsPerLiquidityCumulativeX64": "4965699511176475"
    },{
      "timestampInSec": 1692363257,
      "tickCumulative": -1097823337033,
      "secondsPerLiquidityCumulativeX64": "4965707288910721"
    }
  ],
  "more": false,
  "next_key": ""
}
```
### On-Chain Price Oracle for WAX/USDT Pair
1. Deploy Test Contract: Deploy the test contract oracletest12.
```
cleos -u http://wax.api.eosnation.io set contract oracletest12 ./build/ "alcorpriceoracle_test.wasm" "alcorpriceoracle_test.abi" -p oracletest12@active
```
1. Verify Oldest Observation: Ensure that the oldest observation is at least 30 minutes old.
```
$ cleos -u http://wax.api.eosnation.io push action oracletest12 oldestobser '[1095]' -
-read
executed transaction: 25d99695aa9f4a5cd81a2e53a9c4593307e8ebb04d54d3d1008109fe43017d72  72 bytes  0 us
#  oracletest12 <= oracletest12::oldestobser    {"poolId":1095}
=>                                return value: 7453
7453 seconds = 124 minutes ago
```

1. Get Last Price 
```
cleos -u http://wax.api.eosnation.io push action oracletest12 getprice '[1095, 0]' --read
executed transaction: f5cae63c61fbd4647521177e58eacd7eadbcc8087f69599323982f7076fd298c  80 bytes  0 us
#  oracletest12 <= oracletest12::getprice       {"poolId":1095,"twapInterval":0}
=>                                return value: "73894640228863"
WAX has 8 decimals, USDT has 4 decimals
WAXPriceInUSD = 73894640228863/2^64 * 10^8/10^4 = 0.0400 USDT
```
1. Get Average Price in 30 mintues
```
cleos -u http://wax.api.eosnation.io push action oracletest12 getprice '[1095, 1800]' --read
executed transaction: 90c85d3726610bafbc08fad836349ecf4a6921dfb26ffc1c1812bc9d2ff9eec2  80 bytes  0 us
#  oracletest12 <= oracletest12::getprice       {"poolId":1095,"twapInterval":1800}
=>                                return value: "73848806556989"
WAX has 8 decimals, USDT has 4 decimals
WAXPriceInUSD = 73848806556989/2^64 * 10^8/10^4 = 0.0401 USDT
```
