using namespace eosio;

/**
 * @brief Списание стоимости подписок с биллинг-кошелька пайщика (оплата).
 *
 * Оператор (Восход) одним действием списывает с биллинг-кошелька `w.wal.bill`
 * пайщика суммарную стоимость его активных подписок и зачисляет её в
 * инфраструктурный кошелёк кооператива `w.sov.infra` (ledger2 `o.bil.pay`).
 * Отдельная подпись пайщика не требуется — авторизация обеспечена нахождением
 * контракта в `contracts_whitelist` + фактом конвертации (`convert` = согласие).
 *
 * Состав подписок on-chain не раскрывается: контракт несёт только сумму,
 * `payment_hash` (ссылка на запись в БД провайдера) и memo. Повторный вызов с
 * тем же `payment_hash` — идемпотентный no-op (как `transaction_id` в Epic 3).
 *
 * @param coopname     Кооператив-плательщик.
 * @param username     Пайщик, с чьего биллинг-кошелька списываем.
 * @param amount       Сумма к оплате (RUB, > 0).
 * @param payment_hash Идентификатор платежа из БД провайдера (обязателен).
 * @param memo         Произвольный комментарий (< 256 символов).
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void billing::pay(name coopname, name username, asset amount,
                  checksum256 payment_hash, std::string memo) {
  require_auth(coopname);

  // Плательщик должен быть кооперативом (presence-only, без статуса).
  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма оплаты должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты для оплаты");
  check(payment_hash != checksum256{}, "payment_hash обязателен");
  check(memo.size() < 256, "memo не должен превышать 255 символов");

  // Идемпотентность: повторный вызов с тем же payment_hash — no-op.
  auto existing = Billing::get_payment(coopname, payment_hash);
  if (existing.has_value()) {
    return;
  }

  const std::string ledger_memo =
      memo.empty() ? std::string("Оплата подписки за инфраструктуру") : memo;

  // Списание членских взносов пайщика → инфраструктурный кошелёк кооператива.
  // Если на w.wal.bill недостаточно средств — walletop упадёт доменной ошибкой;
  // оператор фиксирует подписку как просроченную (Epic 4: past_due → grace).
  Ledger2::apply(
    _billing,
    coopname,
    operations::billing::PAY,
    amount,
    username,
    payment_hash,
    ledger_memo
  );

  // Фиксируем факт оплаты для дедупа последующих вызовов.
  Billing::payments_index payments(_billing, coopname.value);
  uint64_t new_id = get_global_id_in_scope(_billing, coopname, "payments"_n);
  payments.emplace(coopname, [&](auto& p) {
    p.id           = new_id;
    p.coopname     = coopname;
    p.username     = username;
    p.amount       = amount;
    p.payment_hash = payment_hash;
    p.paid_at      = time_point_sec(current_time_point());
  });
}
