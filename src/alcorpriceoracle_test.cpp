// "Copyright [2022] <alcor exchange>"

#include <alcorpriceoracle_interface.hpp>

class [[eosio::contract]] alcorpriceoracle_test : public eosio::contract {
 public:
  using contract::contract;
  [[eosio::action]] std::tuple<int32_t, uint64_t> consult(uint64_t poolId, uint32_t secondsAgo) {
    return AlcorPriceOracle::consult(poolId, secondsAgo);
  }
  [[eosio::action]] uint32_t oldestobser(uint64_t poolId) {
    return AlcorPriceOracle::getOldestObservationSecondsAgo(poolId);
  }
  [[eosio::action]] uint128_t getprice(uint64_t poolId, uint32_t twapInterval) {
    return AlcorPriceOracle::getPriceTwapX64(poolId, twapInterval);
  }
};
