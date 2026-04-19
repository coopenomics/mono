/**
 * @brief Миграция остатков с legacy-ledger на ledger2 (пересмотр 2026-04-18).
 *
 * Реализует алгоритм PRD §4.1.6a FR-L-13a: все балансы переносятся через
 * inline `apply(OPENING_*)`, а не прямыми `emplace` в таблицы accounts/wallets.
 * Это даёт единый путь учёта с полной двойной проводкой и audit trail.
 *
 * Алгоритм на каждый кооператив:
 *
 *   1. Читаем legacy `ledger::accounts` (scope = coopname):
 *      cash_legacy  = account[51].available + .blocked
 *      share_legacy = account[80].available + .blocked
 *      entry_legacy = account[861].available + .blocked
 *      (прочие legacy-id игнорируются — в проде других нет)
 *
 *   2. Вычисляем:
 *      share_money = cash_legacy − entry_legacy
 *      rid_share   = share_legacy − share_money
 *
 *      Для обычных кооп. (pgrzosdeyuwg, honruwpdxtty) rid_share = 0.
 *      Для Восхода — 56 833 411 RUB (стоимость РИД в паевом фонде).
 *
 *   3. Отправляем inline apply:
 *      apply(OPENING_CASH,  cash_legacy)   → Dr 51 / Cr 99, wallet CASH_MAIN (1001)
 *      apply(OPENING_SHARE, share_money)   → Dr 99 / Cr 80, wallet SHARE_FUND_PAY (2001)
 *      apply(OPENING_ENTRY, entry_legacy)  → Dr 99 / Cr 86, wallet ENTRANCE_FEES (3001)
 *      apply(OPENING_RID,   rid_share)     → Dr 04 / Cr 80, wallet SHARE_FUND_RID (2003)
 *
 *   4. После прогона для каждого кооп.:
 *      - account[99] сводится к 0 (транзит)
 *      - Σ Dr = Σ Cr (инвариант восстановлен)
 *      - legacy-баланс сохранён: account[80].credit = share_money + rid_share = share_legacy
 *
 * Курсорный режим: `migrate(from_coop_index, limit)`. Полный прогон —
 * `migrate(0, UINT64_MAX)`. Мета фиксирует `last_migrated_coop_index` для
 * возобновления порциями (защита от CPU-лимита при росте кол-ва кооп.).
 *
 * Поле `writeoff` legacy-ledger игнорируется целиком (PRD §4.1.2 FR-L-7).
 *
 * @ingroup public_ledger2_actions
 */

namespace {

/**
 * Читает остатки трёх ключевых счетов legacy-ledger для одного кооп.
 * Возвращает триплет (cash_legacy, share_legacy, entry_legacy).
 */
struct LegacyBalances {
  eosio::asset cash;    ///< 51  — Расчётный счёт
  eosio::asset share;   ///< 80  — Паевой фонд
  eosio::asset entry;   ///< 861 — Вступительные взносы
};

inline LegacyBalances read_legacy_balances(eosio::name coopname) {
  laccounts_index old_accounts(_ledger, coopname.value);

  LegacyBalances r{
    eosio::asset(0, _root_govern_symbol),
    eosio::asset(0, _root_govern_symbol),
    eosio::asset(0, _root_govern_symbol),
  };

  for (auto acc_it = old_accounts.begin(); acc_it != old_accounts.end(); ++acc_it) {
    // writeoff игнорируется (FR-L-7).
    const eosio::asset total = acc_it->available + acc_it->blocked;
    if (total.amount == 0) continue;

    // Symbol guard: legacy должен быть в govern-символе, иначе миграция
    // исказит суммы (прямое присваивание без конверсии).
    eosio::check(total.symbol == _root_govern_symbol,
                 std::string{"migrate: legacy acc "} + std::to_string(acc_it->id) +
                   " имеет неожиданный symbol");

    switch (acc_it->id) {
      case Ledger::accounts::BANK_ACCOUNT:   r.cash  = total; break;   // 51
      case Ledger::accounts::SHARE_FUND:     r.share = total; break;   // 80
      case Ledger::accounts::ENTRANCE_FEES:  r.entry = total; break;   // 861
      default:
        // В проде MVP остальные legacy-id (67 long-term loans, 58, 76.x и т.д.)
        // всегда нулевые, т.к. операций по ним ещё не было. Займы, когда
        // появятся, будут идти через 58 (финансовые вложения) + 51 (расчётный)
        // сразу в ledger2. Защита total==0 выше гарантирует, что никакой
        // ненулевой default-id сюда не просочится; если просочится — это
        // сигнал пересмотреть спеку до migrate, а не молча терять суммы.
        eosio::check(false,
                     std::string{"migrate: неожиданный ненулевой legacy acc id="} +
                       std::to_string(acc_it->id));
    }
  }
  return r;
}

/**
 * Мигрирует один кооп: отправляет inline apply для каждого ненулевого
 * opening-баланса.
 */
inline void migrate_one_coop(eosio::name self_name, eosio::name coopname) {
  const auto b = read_legacy_balances(coopname);

  // share_money = часть паевого фонда, покрытая деньгами на расчётном
  // (за вычетом вступительных, которые уходят на 86).
  const eosio::asset share_money(
    b.cash.amount >= b.entry.amount ? b.cash.amount - b.entry.amount : 0,
    _root_govern_symbol
  );

  // rid_share = часть паевого фонда, не покрытая деньгами = стоимость РИД.
  // Для обычных кооп = 0. Для Восхода = b.share − share_money.
  const eosio::asset rid_share(
    b.share.amount >= share_money.amount ? b.share.amount - share_money.amount : 0,
    _root_govern_symbol
  );

  // Sanity checks.
  eosio::check(b.cash.amount >= b.entry.amount,
               std::string{"migrate: entry > cash на кооп "} + coopname.to_string());
  eosio::check(b.share.amount >= share_money.amount,
               std::string{"migrate: share_money > share_legacy на кооп "} + coopname.to_string());

  // Helper: отправить inline apply только для ненулевых сумм.
  // process_hash: детерминированный, уникальный на пару (coopname, action_code).
  // Нужно чтобы process-registry различал миграционные проводки кооп-а между
  // собой (иначе все с zero-hash сливаются в одну строку реестра).
  auto send = [&](eosio::name code, const eosio::asset& amt) {
    if (amt.amount == 0) return;
    const std::string hash_src =
      std::string{"mig::"} + coopname.to_string() + std::string{"::"} + code.to_string();
    const eosio::checksum256 proc_hash = hashit(hash_src);
    Ledger2::apply(
      self_name,
      coopname,
      code,
      amt,
      eosio::name{}, // username не применим к opening
      proc_hash,
      std::string{"Миграция остатков legacy-ledger → ledger2"}
    );
  };

  send(ledger2_ops::OPENING_CASH,  b.cash);
  send(ledger2_ops::OPENING_SHARE, share_money);
  send(ledger2_ops::OPENING_ENTRY, b.entry);
  send(ledger2_ops::OPENING_RID,   rid_share);
}

} // namespace

void ledger2::migrate(uint64_t from_coop_index, uint64_t limit) {
  require_auth(get_self());

  ledger2_meta_index meta_tbl(get_self(), get_self().value);
  auto meta_it = meta_tbl.find(0);

  // Если полный прогон уже завершён — тихий no-op (Decision #D4 / Story 1.15 AC5).
  if (meta_it != meta_tbl.end() && meta_it->migrated) {
    return;
  }

  // Если мета есть и курсор не совпадает с last_migrated_coop_index — ошибка.
  // Это защищает от непоследовательных batch-прогонов (оператор случайно
  // пропустил кооп).
  if (meta_it != meta_tbl.end()) {
    eosio::check(from_coop_index == meta_it->last_migrated_coop_index,
                 std::string{"migrate: from_coop_index должен продолжать с last_migrated_coop_index="} +
                   std::to_string(meta_it->last_migrated_coop_index));
  } else {
    eosio::check(from_coop_index == 0,
                 "migrate: первый вызов должен начинаться с from_coop_index=0");
  }

  eosio::check(limit > 0, "migrate: limit должен быть больше 0");

  cooperatives2_index coops(_registrator, _registrator.value);

  uint64_t idx  = 0;
  uint64_t done = 0;
  bool reached_end = true;

  for (auto it = coops.begin(); it != coops.end(); ++it, ++idx) {
    if (idx < from_coop_index) continue;
    if (done >= limit) { reached_end = false; break; }

    migrate_one_coop(get_self(), it->username);
    ++done;
  }

  // Guard против permanent-lock при пустой таблице coops или from_coop_index
  // за пределами диапазона: если ничего не мигрировали и это не штатный finish
  // (done > 0 ⇒ прогон состоялся), не флипаем migrated=true.
  if (done == 0 && from_coop_index == 0 && coops.begin() == coops.end()) {
    eosio::check(false, "migrate: таблица cooperatives пуста — повторите после регистрации");
  }

  // Upsert meta.
  const uint64_t new_last_index = from_coop_index + done;
  const uint64_t coops_total    = meta_it == meta_tbl.end() ? done : meta_it->migrated_coops + done;
  const auto     now            = eosio::current_time_point();

  if (meta_it == meta_tbl.end()) {
    meta_tbl.emplace(get_self(), [&](auto& m) {
      m.id                       = 0;
      m.migrated                 = reached_end;
      m.migrated_coops           = coops_total;
      m.last_migrated_coop_index = new_last_index;
      m.migrated_at              = now;
    });
  } else {
    meta_tbl.modify(meta_it, get_self(), [&](auto& m) {
      m.migrated                 = reached_end;
      m.migrated_coops           = coops_total;
      m.last_migrated_coop_index = new_last_index;
      m.migrated_at              = now;
    });
  }
}
