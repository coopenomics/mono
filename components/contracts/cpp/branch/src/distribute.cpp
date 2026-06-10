/**
 * @brief Раскладка поступивших членских взносов кооперативного участка
 * (requirement b6 «Экономика КУ», процесс p.brn.fees).
 *
 * Вызывается inline контрактом-источником (сегодня — marketplace при
 * финализации заказа, signiss2): источник передаёт полную сумму членского
 * взноса по факту (`total_amount`) и её персональную часть по своей отсечке
 * (`personal_amount`). Раскладка:
 *
 *  - персональная часть делится по весам реестра `weights` (braname,
 *    source_contract): o.brn.person каждому участнику на
 *    personal × вес / Σ весов (целочисленно, вниз);
 *  - всё остальное (включая остаток округления и случай «распределение не
 *    настроено») — o.brn.common в общий кошелёк КУ (username = braname).
 *
 * Средства физически уходят с пула w.mkt.fee — он пополнен операцией
 * o.mkt.fee при создании заказа, неиспользованная часть уже возвращена
 * источником через o.mkt.refund.
 *
 * Guards:
 *  - авторизация: кооператив либо системный контракт из whitelist;
 *  - суммы в валюте кооператива; personal ≤ total; total > 0.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::distribute(eosio::name coopname, eosio::name braname,
                                           eosio::name source_contract,
                                           eosio::asset total_amount,
                                           eosio::asset personal_amount,
                                           eosio::checksum256 process_hash,
                                           std::string memo) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  eosio::check(total_amount.is_valid() && total_amount.amount > 0,
               "Сумма распределения должна быть больше нуля");
  eosio::check(total_amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме распределения");
  eosio::check(personal_amount.is_valid() &&
               personal_amount.symbol == _root_govern_symbol,
               "Некорректная персональная часть распределения");
  eosio::check(personal_amount.amount >= 0 &&
               personal_amount.amount <= total_amount.amount,
               "Персональная часть не может превышать сумму распределения");

  get_branch_or_fail(coopname, braname);

  const uint64_t total_weight = get_weight_total(coopname, braname, source_contract);

  int64_t distributed = 0;
  if (personal_amount.amount > 0 && total_weight > 0) {
    branch_weights_index weights(_branch, coopname.value);
    auto idx = weights.get_index<"bycontrbra"_n>();

    for (auto it = idx.lower_bound(combine_ids(source_contract.value, braname.value));
         it != idx.upper_bound(combine_ids(source_contract.value, braname.value)); ++it) {
      const int64_t share = static_cast<int64_t>(
          static_cast<uint128_t>(personal_amount.amount) * it->weight / total_weight);
      if (share <= 0) continue;  // микродоля меньше копейки уходит в общий кошелёк

      Ledger2::apply(_branch, coopname,
                     operations::branch::DISTRIBUTE_PERSONAL,
                     eosio::asset(share, _root_govern_symbol),
                     it->username, process_hash, memo);
      distributed += share;
    }
  }

  // Всё нераспределённое персонально (часть вне отсечки + остаток округления
  // + случай ненастроенных весов) — в общий кошелёк КУ.
  const int64_t common = total_amount.amount - distributed;
  if (common > 0) {
    Ledger2::apply(_branch, coopname,
                   operations::branch::DISTRIBUTE_COMMON,
                   eosio::asset(common, _root_govern_symbol),
                   braname, process_hash, memo);
  }
}
