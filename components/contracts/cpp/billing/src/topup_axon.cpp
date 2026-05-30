using namespace eosio;

/**
 * @brief Epic 13 v5.1 — документless докупка пакета PowerUp (CPU/NET/RAM).
 *
 * Списывает с биллинг-кошелька кооператива-пайщика `w.wal.bill[coopname]`
 * (COOPERATIVE) сумму, на которую coopback кооператива (PowerupPlugin) намерен
 * докупить пакет ресурсов через `eosio::powerup`. На уровне ledger2 это
 * фиксируется как `o.bil.axn` / `WalletOp::BURN` без destination —
 * членский взнос «потрачен на инфраструктурный пакет». Реальный AXON-перевод
 * между token-аккаунтами для покупки PowerUp делает сам PowerupPlugin
 * отдельной transaction, без участия этого контракта (L1 eosio.token / eosio.powerup
 * — вне ledger2-плоскости).
 *
 * В отличие от `pay` (time-подписки):
 *  - нет username — биллинг-фонд COOPERATIVE, scope=coopname;
 *  - нет document — PowerupPlugin исполняет процесс по факту threshold или
 *    календарного триггера, согласие пайщика-кооператива воплощено в активном
 *    статусе пакетной подписки (`subscription_type.kind='package'`) у provider'а;
 *  - идемпотентность по `payment_hash` — на стороне provider (детерминированный
 *    sha256 от (coopname, period_start, action_name, idx); provider у себя ведёт
 *    `billing_invoice` с UNIQUE(payment_hash) и на повтор отвечает 200 OK без
 *    side-эффектов).
 *
 * Authorization: `coopname@active` — PowerupPlugin подписывает action ключом
 * coopname@active напрямую, без relay через оператора Восхода.
 *
 * @param coopname     Кооператив-пайщик (он же scope биллинг-кошелька).
 * @param amount       Сумма расхода в RUB (root_govern_symbol), > 0.
 * @param payment_hash Детерминированный sha256-якорь докупки (>= 1 байт ≠ 0).
 *                     Provider строит его как sha256(coopname || period_start ||
 *                     action_name || idx), чтобы повторный приём событий парсером
 *                     был no-op на стороне provider.
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void billing::topupaxon(name coopname, asset amount, checksum256 payment_hash) {
  require_auth(coopname);

  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма докупки должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты для докупки PowerUp");
  check(payment_hash != checksum256{}, "payment_hash обязателен (детерминированный якорь докупки)");

  const std::string memo = "Расход на пакет PowerUp (CPU/NET/RAM) кооператива " + coopname.to_string();

  // BURN с биллинг-кошелька кооператива — реклассификация внутри 86
  // (членский взнос потрачен на инфраструктурный пакет). Username не нужен —
  // BILLING_FUND_PAY теперь COOPERATIVE, L3-разрез не требуется (Epic 13 Story 13.2).
  Ledger2::apply(
    _billing,
    coopname,
    operations::billing::TOPUP_AXON,
    amount,
    coopname,    // L3-параметр игнорируется для kind=COOPERATIVE; передаём coopname для совместимости сигнатуры.
    payment_hash,
    memo
  );
}
