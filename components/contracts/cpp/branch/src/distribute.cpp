/**
 * @brief Ручное распределение средств общего кошелька кооперативного
 * участка (requirement b6 «Экономика КУ», раунд 5; процесс p.brn.fees).
 *
 * Команда председателя КУ (НЕ автоматическое действие при финализации
 * заказа — приоритет общего кошелька, решение владельца 2026-06-10):
 * председатель указывает сумму, она раскладывается по весам реестра
 * `weights` (braname, source_contract). Можно распределять не всё и
 * несколько раз. Плановый резерв расходов (30 дней) контролирует бэкенд
 * до отправки транзакции — гард сознательно оффчейн до шасси расходов.
 *
 * Раскладка per-доверенный — двухходовка (walletop несёт один username,
 * прямой TRANSFER между USER_SHARED-разрезами braname → доверенный
 * невозможен):
 *
 *  - o.brn.release: TRANSFER w.brn.common → w.brn.pool (username = braname);
 *  - o.brn.person:  TRANSFER w.brn.pool → w.brn.person (username = доверенный).
 *
 * Обе ноги выполняются на фактическую долю (целочисленно, вниз), поэтому
 * транзитный пул w.brn.pool в нуле после транзакции, а остаток округления
 * вообще не покидает общий кошелёк. Состояния в RAM раунд не оставляет:
 * история распределений собирается парсером из самого действия (таблица
 * blockchain_actions), round_hash — process_hash ledger2-операций.
 *
 * Guards:
 *  - авторизация: кооператив либо системный контракт из whitelist
 *    (председательство проверяет бэкенд — все пути идут через контроллер);
 *  - сумма в валюте кооператива, больше нуля;
 *  - веса настроены (Σ весов > 0);
 *  - достаточность общего кошелька проверяет сам ledger2 при o.brn.release.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::distribute(eosio::name coopname, eosio::name braname,
                                           eosio::name source_contract,
                                           eosio::checksum256 round_hash,
                                           eosio::asset amount,
                                           std::string memo) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма распределения должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме распределения");

  get_branch_or_fail(coopname, braname);

  const uint64_t total_weight = get_weight_total(coopname, braname, source_contract);
  eosio::check(total_weight > 0,
               "Распределение не настроено: задайте веса участников реестра распределения");

  branch_weights_index weights(_branch, coopname.value);
  auto idx = weights.get_index<"bycontrbra"_n>();

  int64_t distributed = 0;
  for (auto it = idx.lower_bound(combine_ids(source_contract.value, braname.value));
       it != idx.upper_bound(combine_ids(source_contract.value, braname.value)); ++it) {
    const int64_t share = static_cast<int64_t>(
        static_cast<uint128_t>(amount.amount) * it->weight / total_weight);
    if (share <= 0) continue;  // микродоля меньше копейки остаётся в общем кошельке

    const eosio::asset share_asset(share, _root_govern_symbol);

    // Первая нога: изъятие доли из общего кошелька в транзитный пул.
    Ledger2::apply(_branch, coopname,
                   operations::branch::RELEASE_FROM_COMMON,
                   processes::branch::FEES,
                   share_asset, braname, round_hash, memo);

    // Вторая нога: зачисление доли доверенному из транзитного пула.
    Ledger2::apply(_branch, coopname,
                   operations::branch::DISTRIBUTE_PERSONAL,
                   processes::branch::FEES,
                   share_asset, it->username, round_hash, memo);

    distributed += share;
  }

  eosio::check(distributed > 0,
               "Сумма распределения слишком мала: доли всех участников округлились до нуля");
}
