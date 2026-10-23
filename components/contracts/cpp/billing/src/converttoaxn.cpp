using namespace eosio;

/**
 * @brief Epic 13 v5.1 — бездокументарная конвертация членского взноса в AXON.
 *
 * Списывает с биллинг-кошелька кооператива-пайщика `w.wal.bill` (USER_SHARED,
 * L3-разрез по @p coopname в леджере оператора `_provider`) сумму членского
 * взноса в RUB и эмитирует кооперативу эквивалент в AXON по курсу 10 ₽ = 1 AXON
 * (`eosio::injection` из фонда eosio.saving). Это второй шаг двухшаговой модели:
 *   1) паевой → членский — `billing::convert` (документарно, по заявлению пайщика);
 *   2) членский → AXON    — этот action (бездокументарно, автономно).
 *
 * Авторизация — ОПЕРАТОР платформы (`_provider`): операция расходует членские
 * взносы, которые учитываются в леджере оператора, а транзакции по своему
 * леджеру подписывает сам кооператив-оператор (решение @ant 2026-06-11).
 * Кооперативы-спицы своими ключами управляют ТОЛЬКО полученным AXON
 * (`eosio::powerup` со своего баланса) — права трогать членские взносы у них нет.
 *
 * Инициатор — hub-cron Восхода (BILLING_HUB_MODE=true): он мониторит ликвидный
 * AXON-баланс спиц и при исчерпании докупает пакет по тарифу провайдера
 * (квоту/cooldown enforce'ит провайдер при выписке package-invoice).
 *
 * Единственный источник реального токена AXON в системе — `eosio::injection`
 * внутри этого action. Расход членского фиксируется в ledger2 как
 * `o.bil.axn` / `WalletOp::BURN` (членский взнос потрачен на инфраструктуру),
 * иначе двойной учёт: членский остался бы доступен и AXON был бы эмитирован.
 *
 * @param coopname     Кооператив-пайщик: владелец L3-разреза биллинг-кошелька
 *                     и получатель AXON.
 * @param amount       Сумма членского взноса к конвертации (RUB, > 0).
 * @param payment_hash Детерминированный sha256-якорь конвертации (>= 1 байт ≠ 0).
 *                     Его выдаёт провайдер при выписке package-invoice; дедуп
 *                     повторов — журнал PG оператора (контракт таблиц не ведёт,
 *                     RAM чейна на платежи не тратится).
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p _provider
 */
void billing::converttoaxn(name coopname, asset amount, checksum256 payment_hash) {
  require_auth(_provider);

  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма конвертации должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты. Ожидается RUB");
  check(payment_hash != checksum256{}, "payment_hash обязателен (детерминированный якорь конвертации)");

  // Курс 10:1 (10 RUB = 1 AXON).
  int64_t axon_amount = amount.amount / 10;
  check(axon_amount > 0, "После конвертации сумма AXON должна быть положительной");
  eosio::asset axon_quantity(axon_amount, _root_symbol);

  const std::string memo =
      "Конвертация членского взноса в AXON, кооператив " + coopname.to_string();

  // BURN членского с биллинг-кошелька пайщика (USER_SHARED, разрез по
  // кооперативу-пайщику) В ЛЕДЖЕРЕ ОПЕРАТОРА (_provider): биллинг живёт у
  // оператора, где каждый кооператив-пайщик — обычный username (решение @ant
  // 2026-06-11) — там же, куда средства положил billing::convert. Без
  // destination — реальный токен AXON эмитируется отдельной инъекцией ниже
  // (L1 eosio.token).
  Ledger2::apply(
    _billing,
    _provider,
    operations::billing::CONVERT_TO_AXON,
    processes::billing::PAY,
    amount,
    coopname,    // L3-разрез: кооператив-пайщик, владелец биллинг-кошелька.
    payment_hash,
    memo
  );

  // Инъекция AXON на кооператив — единственный источник реального токена AXON.
  // injection требует require_auth(_billing); billing авторизуется как сам себя.
  action(
      permission_level{ _billing, "active"_n },
      _system,
      "injection"_n,
      std::make_tuple(coopname, axon_quantity)
  ).send();
}
