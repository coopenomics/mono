using namespace eosio;

/**
 * @brief Списание стоимости подписок с биллинг-кошелька пайщика (оплата).
 *
 * Оператор платформы (`_provider`, Восход) одним действием списывает с
 * биллинг-кошелька `w.wal.bill` суммарную стоимость активных time-подписок
 * кооператива и зачисляет её в инфраструктурный кошелёк `w.sov.infra`
 * (ledger2 `o.bil.pay`). Отдельная подпись пайщика не требуется: членский
 * взнос на биллинг-кошельке — целевой (внесён заявлением о конвертации
 * «прошу сконвертировать паевой взнос в членский» именно на оплату
 * инфраструктуры), поэтому отдельного распоряжения на каждое списание нет.
 *
 * Состав подписок on-chain не раскрывается: контракт несёт только сумму,
 * `payment_hash` (ссылка на запись в БД провайдера) и memo.
 *
 * Anti-replay: повтор `payment_hash` отклоняется on-chain (таблица
 * `paidpayments`). Это страхует средства пайщика от двойного списания, если
 * инициатор (cron coopback'а Восхода) не получил подтверждение и повторил
 * вызов — упавший парсер или backend между transact и callback провайдеру
 * больше не приводят к спаму повторных оплат.
 *
 * @param coopname     Кооператив-плательщик.
 * @param username     Пайщик, с чьего биллинг-кошелька списываем.
 * @param amount       Сумма к оплате (RUB, > 0).
 * @param payment_hash Идентификатор платежа из БД провайдера (обязателен).
 * @param memo         Произвольный комментарий (< 256 символов).
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p _provider
 */
void billing::pay(name coopname, name username, asset amount,
                  checksum256 payment_hash, std::string memo) {
  // Списание авторизует оператор платформы: он ведёт учёт подписок (provider
  // backend) и инициирует рекуррентные платежи. Ключей кооперативов-спиц у
  // оператора нет и быть не должно.
  require_auth(_provider);

  // Плательщик должен быть кооперативом (presence-only, без статуса).
  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма оплаты должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты для оплаты");
  check(payment_hash != checksum256{}, "payment_hash обязателен");
  check(memo.size() < 256, "memo не должен превышать 255 символов");

  // Anti-replay: первый и единственный проход для этого payment_hash.
  Billing::assert_first_payment_and_register(_billing, payment_hash);

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
}
