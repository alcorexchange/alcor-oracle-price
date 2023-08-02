// "Copyright [2022] <alcor exchange>"

#include <alcorswap_interface.hpp>

class [[eosio::contract]] alcororacleprice_test : public eosio::contract {
 public:
  using contract::contract;
  [[eosio::action]] std::tuple<int32_t, uint64_t> consult(uint64_t poolId, uint32_t secondsAgo) {
    return AlcorOraclePrice::consult(poolId, secondsAgo);
  }
  [[eosio::action]] uint32_t oldestobser(uint64_t poolId) {
    return AlcorOraclePrice::getOldestObservationSecondsAgo(poolId);
  }
  [[eosio::action]] uint128_t getprice(uint64_t poolId, uint32_t twapInterval) {
    return AlcorOraclePrice::getPriceTwapX64(poolId, twapInterval);
  }
};
