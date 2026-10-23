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
 * Дедуп повторов `payment_hash` — в журнале PG оператора (запись до transact):
 * контракт своих таблиц не ведёт, RAM чейна на платежи не тратится.
 *
 * @param coopname     Кооператив-оператор, в чьём леджере живёт биллинг
 *                     (на платформе — Восход/_provider).
 * @param username     Пайщик-плательщик, с чьего биллинг-кошелька списываем
 *                     (L3-разрез `w.wal.bill` USER_SHARED; для
 *                     кооперативов-спиц username = их coopname).
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

  // coopname — кооператив-оператор (его леджер), username — пайщик-плательщик
  // (кооператив-спица). Оба presence-only, без статуса.
  Billing::assert_payer_is_cooperative(coopname);
  Billing::assert_payer_is_cooperative(username);

  check(amount.is_valid() && amount.amount > 0, "Сумма оплаты должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты для оплаты");
  check(payment_hash != checksum256{}, "payment_hash обязателен");
  check(memo.size() < 256, "memo не должен превышать 255 символов");

  const std::string ledger_memo =
      memo.empty() ? std::string("Оплата подписки за инфраструктуру") : memo;

  // Списание членских взносов пайщика → инфраструктурный кошелёк кооператива.
  // Если на w.wal.bill недостаточно средств — walletop упадёт доменной ошибкой;
  // оператор фиксирует подписку как просроченную (Epic 4: past_due → grace).
  Ledger2::apply(
    _billing,
    coopname,
    operations::billing::PAY,
    processes::billing::PAY,
    amount,
    username,
    payment_hash,
    ledger_memo
  );
}
