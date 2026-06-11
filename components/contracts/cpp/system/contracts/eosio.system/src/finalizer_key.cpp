#include <eosio.system/eosio.system.hpp>

#include <eosio/crypto_bls_ext.hpp>
#include <eosio/instant_finality.hpp>

#include <cstring>
#include <unordered_set>

namespace eosiosystem {

// Порт setfinalizer из upstream eosio.bios (reference-contracts):
// все дорогие проверки выполняются здесь, чтобы хост-функция
// set_finalizers гарантированно не упала.
void system_contract::setfinalizer( const finalizer_policy& finalizer_policy ) {
   require_auth( get_self() );

   check(finalizer_policy.finalizers.size() <= max_finalizers, "number of finalizers exceeds the maximum allowed");
   check(finalizer_policy.finalizers.size() > 0, "require at least one finalizer");

   eosio::finalizer_policy fin_policy;
   fin_policy.threshold = finalizer_policy.threshold;
   fin_policy.finalizers.reserve(finalizer_policy.finalizers.size());

   const std::string pk_prefix = "PUB_BLS";
   const std::string sig_prefix = "SIG_BLS";

   // сырой affine-формат (bls_g1 = std::array<char, 96>) для проверки уникальности
   struct g1_hash {
      std::size_t operator()(const eosio::bls_g1& g1) const {
         std::hash<const char*> hash_func;
         return hash_func(g1.data());
      }
   };
   struct g1_equal {
      bool operator()(const eosio::bls_g1& lhs, const eosio::bls_g1& rhs) const {
         return std::memcmp(lhs.data(), rhs.data(), lhs.size()) == 0;
      }
   };
   std::unordered_set<eosio::bls_g1, g1_hash, g1_equal> unique_finalizer_keys;

   uint64_t weight_sum = 0;

   for (const auto& f: finalizer_policy.finalizers) {
      check(f.description.size() <= max_finalizer_description_size, "Finalizer description greater than max allowed size");

      // базовые проверки формата ключа
      check(f.public_key.substr(0, pk_prefix.length()) == pk_prefix, "public key shoud start with PUB_BLS");
      check(f.pop.substr(0, sig_prefix.length()) == sig_prefix, "proof of possession signature should start with SIG_BLS");

      // защита от переполнения суммы весов
      check(std::numeric_limits<uint64_t>::max() - weight_sum >= f.weight, "sum of weights causes uint64_t overflow");
      weight_sum += f.weight;

      // decode_bls_public_key_to_g1 сам падает (check) на невалидном ключе
      const auto pk = eosio::decode_bls_public_key_to_g1(f.public_key);
      check(unique_finalizer_keys.insert(pk).second, "duplicate public key");

      const auto signature = eosio::decode_bls_signature_to_g2(f.pop);

      // проверка владения приватным ключом
      check(eosio::bls_pop_verify(pk, signature), "proof of possession failed");

      std::vector<char> pk_vector(pk.begin(), pk.end());
      fin_policy.finalizers.emplace_back(eosio::finalizer_authority{f.description, f.weight, std::move(pk_vector)});
   }

   check( weight_sum >= finalizer_policy.threshold && finalizer_policy.threshold > weight_sum / 2,
          "Finalizer policy threshold must be greater than half of the sum of the weights, and less than or equal to the sum of the weights");

   set_finalizers(std::move(fin_policy));
}

} /// namespace eosiosystem
