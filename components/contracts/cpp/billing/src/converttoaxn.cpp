using namespace eosio;

/**
 * @brief Epic 13 v5.1 — бездокументарная конвертация членского взноса в AXON.
 *
 * Списывает с биллинг-кошелька кооператива-пайщика `w.wal.bill[coopname]`
 * (COOPERATIVE) сумму членского взноса в RUB и эмитирует кооперативу
 * эквивалент в AXON по курсу 10 ₽ = 1 AXON (`eosio::injection` из фонда
 * eosio.saving). Это второй шаг двухшаговой модели:
 *   1) паевой → членский — `billing::convert` (документарно, по заявлению пайщика);
 *   2) членский → AXON    — этот action (бездокументарно, автономно).
 *
 * Применяется и при онбординге кооператива (после `billing::convert` по
 * соглашению о подключении к платформе), и в пакетной модели PowerUp:
 * PowerupPlugin coopback'а пайщика подписывает action ключом `coopname@active`
 * напрямую, без участия оператора Восхода и без согласования с provider'ом на
 * горячем пути (provider фиксирует факт реактивно через парсер → callback).
 *
 * Единственный источник реального токена AXON в системе — `eosio::injection`
 * внутри этого action. Расход членского фиксируется в ledger2 как
 * `o.bil.axn` / `WalletOp::BURN` (членский взнос потрачен на инфраструктуру),
 * иначе двойной учёт: членский остался бы доступен и AXON был бы эмитирован.
 *
 * @param coopname     Кооператив-пайщик (он же scope биллинг-кошелька и
 *                     получатель AXON). Подписывает `coopname@active`.
 * @param amount       Сумма членского взноса к конвертации (RUB, > 0).
 * @param payment_hash Детерминированный sha256-якорь конвертации (>= 1 байт ≠ 0).
 *                     Provider строит его как sha256(coopname || period_start ||
 *                     action_name || idx) и дедуплицирует у себя.
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void billing::converttoaxn(name coopname, asset amount, checksum256 payment_hash) {
  require_auth(coopname);

  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма конвертации должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты. Ожидается RUB");
  check(payment_hash != checksum256{}, "payment_hash обязателен (детерминированный якорь конвертации)");

  // Anti-replay: повтор того же payment_hash (например, PowerupPlugin повторил
  // вызов, не получив подтверждение) не должен повторно жечь членские взносы.
  Billing::assert_first_payment_and_register(_billing, payment_hash);

  // Курс 10:1 (10 RUB = 1 AXON).
  int64_t axon_amount = amount.amount / 10;
  check(axon_amount > 0, "После конвертации сумма AXON должна быть положительной");
  eosio::asset axon_quantity(axon_amount, _root_symbol);

  const std::string memo =
      "Конвертация членского взноса в AXON, кооператив " + coopname.to_string();

  // BURN членского с биллинг-кошелька кооператива (kind=COOPERATIVE, scope=coopname):
  // членский взнос потрачен на инфраструктуру/ресурсы. Без destination —
  // реальный токен AXON эмитируется отдельной инъекцией ниже (L1 eosio.token).
  Ledger2::apply(
    _billing,
    coopname,
    operations::billing::CONVERT_TO_AXON,
    amount,
    coopname,    // L3 игнорируется для COOPERATIVE; передаём coopname для совместимости сигнатуры.
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
