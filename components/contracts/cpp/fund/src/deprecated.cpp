/**
 * Прежний учёт фондов в таблицах контракта — отключён (задача 99D-25,
 * решение владельца 03.11.2026).
 *
 * Остатки и движения фондов ведёт ledger2 на кошельках фондов; собственные
 * счета контракта (`coopwallet`, `accfunds.available`, `expfunds.expended`) и
 * заявки на вывод (`fwithdraws`) больше не ведутся — на проде они расходились с
 * книгой и запутали учёт. Сигнатуры действий сохранены, чтобы прежние вызовы
 * получали понятный отказ с кодом, а не ошибку ABI. Строки старых таблиц
 * стирает `fund::cleanup` на деплое.
 *
 * Набор фондов фиксирован Положением о фондах: пять стандартных фондов, у
 * каждого свой кошелёк, заданный при сборке. Заведение и удаление фондов советом
 * отвечают `FUND_FUNDS_FIXED`; когда понадобится — отдельной задачей.
 */
namespace {
[[noreturn]] void fund_deprecated() {
  eosio::check(false,
               "FUND_DEPRECATED: Прежний учёт фондов отключён — остатки и движения фондов ведёт ledger2 на кошельках фондов");
  __builtin_unreachable();
}
[[noreturn]] void fund_funds_fixed() {
  eosio::check(false,
               "FUND_FUNDS_FIXED: Набор фондов кооператива фиксирован — пять стандартных фондов, заведение и удаление не предусмотрены");
  __builtin_unreachable();
}
} // namespace

// ── Набор фондов фиксирован ──────────────────────────────────────────────────

[[eosio::action]] void fund::createfund(eosio::name, eosio::name, eosio::name, eosio::name,
                                        std::string, std::string, uint64_t) {
  fund_funds_fixed();
}

[[eosio::action]] void fund::delfund(eosio::name, eosio::name, eosio::name, uint64_t) {
  fund_funds_fixed();
}

// ── Прежний учёт остатков ────────────────────────────────────────────────────

[[eosio::action]] void fund::newfund(eosio::name, eosio::name, uint64_t) { fund_deprecated(); }
[[eosio::action]] void fund::newwithdraw(eosio::name, eosio::name, uint64_t) { fund_deprecated(); }
[[eosio::action]] void fund::addcirculate(eosio::name, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::subcirculate(eosio::name, eosio::asset, bool) { fund_deprecated(); }
[[eosio::action]] void fund::addaccum(eosio::name, uint64_t, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::subaccum(eosio::name, uint64_t, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::addexpense(eosio::name, uint64_t, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::accumfee(eosio::name, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::addinitial(eosio::name, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::subinitial(eosio::name, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::spreadamount(eosio::name, eosio::asset) { fund_deprecated(); }
[[eosio::action]] void fund::fundwithdraw(eosio::name, eosio::name, eosio::name, uint64_t,
                                          document2, eosio::asset, std::string) {
  fund_deprecated();
}
[[eosio::action]] void fund::authorize(eosio::name, eosio::name, uint64_t) { fund_deprecated(); }
[[eosio::action]] void fund::complete(eosio::name, eosio::name, uint64_t) { fund_deprecated(); }
