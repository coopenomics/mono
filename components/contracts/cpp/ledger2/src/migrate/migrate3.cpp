/**
 * @brief Идемпотентная per-record миграция L3-балансов (Phase 1/Phase 2; ADR-008).
 *
 * Заполняет `userwallets[coopname][wallet_name, username]` переданными
 * значениями. Идемпотентно: при повторном вызове с теми же параметрами state
 * приводится к тому же значению (overwrite, не инкремент).
 *
 * Без бух-проводок: заполнение L3 — инициализация состояния, не финансовая
 * операция (Σ L3 ↔ Σ L2 уже сходится после migrate.cpp Эпика 1, либо
 * заполняется до согласования инварианта; cross-contract проверки введёт
 * Story 3.2 на нормальном пути walletop, не на migrate3).
 *
 * Без сверки с `wallet::users.programs[]`: миграция допускается до того, как
 * программные соглашения переедут в `wallet::users`. Порядок миграции
 * определяется rollout-окном.
 *
 * Auto-delete: если переданы (available=0, blocked=0) — запись удаляется.
 *
 * Auth: `ledger2@active` (через `get_self()`), payer: `ledger2`. Так миграция
 * работает для ЛЮБОГО кооператива без ключей от coopname — у нас по контракту
 * есть только своя подпись. RAM, расход на которую — это сам контракт.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::migrate3(eosio::name coopname,
                       eosio::name wallet_name,
                       eosio::name username,
                       eosio::asset available,
                       eosio::asset blocked) {
  require_auth(get_self());

  eosio::check(coopname.value != 0, "migrate3: coopname пустой");
  get_cooperative_or_fail(coopname);

  eosio::check(wallet_name.value != 0, "migrate3: wallet_name пустой");
  eosio::check(ledger2_is_known_wallet(wallet_name),
               std::string{"migrate3: неизвестный wallet_name "} + wallet_name.to_string());

#ifndef IS_TESTNET
  // voskhod: мин.паевые перенесены на w.sov.mnused (COOPERATIVE) при миграции —
  // см. migrate_voskhod_facts. L3 для w.reg.minshr на voskhod не создаётся,
  // иначе сломается инвариант Σ L3 == L2 (L2 пуст, а 048 написал бы 34 L3-записи).
  eosio::check(!(coopname == "voskhod"_n && wallet_name == ledger2_wallets::MIN_SHARE_FUND),
               "migrate3: voskhod не использует w.reg.minshr — мин.паевые на w.sov.mnused "
               "(см. migrate_voskhod_facts); migrator-048 должен пропускать voskhod");
#endif
  eosio::check(ledger2_get_wallet_kind(wallet_name) == WalletKind::USER_SHARED,
               std::string{"migrate3: wallet_name "} + wallet_name.to_string() +
                 " не USER_SHARED — L3-запись не имеет смысла");

  eosio::check(username.value != 0, "migrate3: username пустой");

  eosio::check(available.is_valid() && blocked.is_valid(),
               "migrate3: некорректный asset");
  eosio::check(available.amount >= 0 && blocked.amount >= 0,
               "migrate3: значения должны быть неотрицательными");
  eosio::check(available.symbol == _root_govern_symbol &&
               blocked.symbol == _root_govern_symbol,
               "migrate3: некорректный символ валюты");

  userwallets_index user_wallets(get_self(), coopname.value);
  auto idx = user_wallets.get_index<"byuserwallet"_n>();
  auto it  = idx.find(combine_ids(wallet_name.value, username.value));

  const bool is_zero = (available.amount == 0 && blocked.amount == 0);

  if (it == idx.end()) {
    if (is_zero) return; // нечего создавать; безопасный no-op для повторов
    const uint64_t new_id = user_wallets.available_primary_key();
    user_wallets.emplace(get_self(), [&](auto& uw) {
      uw.id          = new_id;
      uw.wallet_name = wallet_name;
      uw.username    = username;
      uw.available   = available;
      uw.blocked     = blocked;
    });
  } else {
    if (is_zero) {
      idx.erase(it);
    } else {
      auto pri = user_wallets.find(it->id);
      user_wallets.modify(pri, get_self(), [&](auto& uw) {
        uw.available = available;
        uw.blocked   = blocked;
      });
    }
  }
}
