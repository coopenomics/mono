/**
 * @brief Отправить удержанный НДФЛ на оплату в бюджет — единый налоговый
 * платёж (requirement b6 «Экономика КУ», решение владельца 2026-08-13).
 *
 * Удержанный при выплатах материальной помощи налог (o.brn.aidtax) копится
 * обязательством на счёте 68; его остаток — баланс кошелька `w.brn.ndfl`.
 * Здесь бухгалтер отправляет накопленное на оплату: заявка регистрируется
 * исходящим платежом в gateway и попадает к кассиру. Списание o.brn.taxpay
 * (Дт 68 / Кт 51) произойдёт позже — в callback'е `taxconfirm`, после
 * фактического перевода по реквизитам налоговой.
 *
 * Решение совета не требуется: перечисление удержанного налога — обязанность
 * налогового агента, а не распоряжение средствами кооператива. Эти деньги
 * получателю уже не принадлежат — они вычтены из его выплаты.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива;
 *  - заявка с таким hash не существует;
 *  - amount ≤ остатка `w.brn.ndfl` — перечислить больше удержанного налоговый
 *    агент не вправе; заодно это ловит попытку заплатить дважды по одному и
 *    тому же удержанию.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::createtax(eosio::name coopname,
                                          eosio::checksum256 tax_hash,
                                          eosio::asset amount,
                                          std::string meta) {
  check_auth_or_fail(_branch, coopname, coopname, "createtax"_n);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма к перечислению должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме налогового платежа");

  branch_taxes_index taxes(_branch, coopname.value);
  auto byhash = taxes.get_index<"byhash"_n>();
  eosio::check(byhash.find(tax_hash) == byhash.end(),
               "Заявка на перечисление налога с таким идентификатором уже создана");

  // Остаток кошелька удержанного налога — потолок платежа. Кошелька может не
  // быть вовсе (ни одного удержания не проводилось) — это тот же ноль.
  wallets2_index wallets(_ledger2, coopname.value);
  auto wallet = wallets.find(ledger2_wallets::BRANCH_NDFL_WITHHELD.value);
  const eosio::asset withheld = wallet == wallets.end()
    ? eosio::asset(0, _root_govern_symbol)
    : wallet->available;

  eosio::check(amount <= withheld,
               "Сумма платежа превышает удержанный налог: перечислить можно не больше того, что удержано");

  taxes.emplace(coopname, [&](auto& t) {
    t.id     = taxes.available_primary_key();
    t.hash   = tax_hash;
    t.amount = amount;
  });

  // Заявка передаётся кассиру. Получателя платежа как пайщика здесь нет —
  // деньги уходят в бюджет, поэтому в outcome идёт сам кооператив.
  Gateway::create_outcome(_branch, coopname, coopname, tax_hash, amount,
                          _branch, "taxconfirm"_n, "taxdecline"_n);
}
