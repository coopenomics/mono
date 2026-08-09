/**
 * @brief Перевод персональных средств доверенного КУ в членский кошелёк
 * «Стола заказов» (requirement b6 «Экономика КУ», процесс p.brn.fees).
 *
 * Одна ledger2-операция:
 *  - o.brn.conv (TRANSFER w.brn.person → w.mkt.member, без проводки — оба
 *    кошелька на счёте 86): распределённые членские средства доверенного
 *    становятся членскими средствами «Стола заказов», и он заказывает
 *    имущество как обычный пайщик.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива;
 *  - доверенный — активный пайщик кооператива;
 *  - достаточность L3-средств на w.brn.person и подписанная программа «Стола
 *    заказов» для w.mkt.member проверяются внутри ledger2::walletop.
 *
 * @note Авторизация требуется от аккаунта: @p coopname (инициирует сам
 * доверенный из ЛК стола ПВЗ, право проверяет бэкенд).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::convert(eosio::name coopname, eosio::name username,
                                        eosio::checksum256 convert_hash,
                                        eosio::asset amount) {
  check_auth_or_fail(_branch, coopname, coopname, "convert"_n);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма перевода должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме перевода");

  get_participant_or_fail(coopname, username);

  Ledger2::apply(_branch, coopname,
                 operations::branch::CONVERT_TO_MKT,
                 amount, username, convert_hash,
                 "Перевод персональных членских средств в кошелёк «Стола заказов»");
}
