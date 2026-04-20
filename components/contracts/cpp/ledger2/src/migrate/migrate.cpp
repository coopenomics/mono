/**
 * @brief Миграция остатков с legacy-ledger на ledger2 (пересмотр 2026-04-20).
 *
 * Разделение на два независимых потока:
 *
 *   A. **Бухгалтерские остатки** из `ledger::accounts` (scope=coopname,
 *      contract=_ledger) → через 4 inline `apply(TRANSIT_*)` с полной
 *      двойной проводкой. Счета: 51 / 80 / 86 / 04.
 *
 *   B. **Программные кошельки** из `soviet::progwallets` (scope=coopname,
 *      contract=_soviet) → прямой `wallets2.emplace` в ledger2 БЕЗ
 *      бух-проводок. Legacy::accounts и soviet::progwallets — параллельные
 *      системы учёта, progwallet.blocked не проводится через 80-й счёт,
 *      поэтому любая попытка провести его через Dr 51 / Cr 80 вызовет
 *      двойной учёт на бухуровне. Вместо этого переносим только
 *      wallet-аналитику (9001 BLAGOROST_INVEST, 10001 GENERATOR_COMMIT).
 *
 * Алгоритм на каждый кооператив:
 *
 *   1. Чтение legacy-счетов (laccounts_index, scope=coopname):
 *        cash_legacy  = account[51].available + .blocked
 *        share_legacy = account[80].available + .blocked
 *        entry_legacy = account[861].available + .blocked
 *
 *   2. Чтение параметров кооператива (cooperative2, scope=_registrator):
 *        min_share_value = cooperative2.minimum
 *        N_active        = cooperative2.active_participants_count
 *          (fallback — participants_index, scope=coopname, status=='accepted')
 *
 *   3. Вычисление распределения:
 *        share_money    = cash_legacy − entry_legacy
 *        rid_share      = share_legacy − share_money
 *        min_total      = clamp(N_active * min_share_value,  0, share_money)
 *        share_remain   = share_money − min_total
 *
 *      Инварианты (eosio::check):
 *        cash_legacy  >= entry_legacy
 *        share_legacy >= share_money
 *
 *   4. Отправка 4 inline apply (ненулевые пропускаются):
 *        apply(TRANSIT_MIN_SHARE, min_total)     → Dr 51 / Cr 80, MIN_SHARE_FUND 2002
 *        apply(TRANSIT_SHARE,     share_remain)  → Dr 51 / Cr 80, SHARE_FUND_PAY 2001
 *        apply(TRANSIT_ENTRY,     entry_legacy)  → Dr 51 / Cr 86, ENTRANCE_FEES 3001
 *        apply(TRANSIT_RID,       rid_share)     → Dr 04 / Cr 80, SHARE_FUND_RID 2003
 *
 *   5. Прямой emplace в wallets2 для progwallets (БЕЗ бух-проводок):
 *        Σ progwallet[blagorost].blocked → wallets2[BLAGOROST_INVEST 9001]
 *        Σ progwallet[generator].blocked → wallets2[GENERATOR_COMMIT 10001]
 *
 *      Если запись wallets2 уже есть (после inline apply сработали) —
 *      aggregate через wallets.modify(available += sum). Иначе — emplace.
 *
 * Курсорный режим: `migrate(from_coop_index, limit)`. Полный прогон —
 * `migrate(0, UINT64_MAX)`. Мета фиксирует `last_migrated_coop_index`.
 *
 * Поле `writeoff` legacy-ledger игнорируется целиком (PRD §4.1.2 FR-L-7).
 *
 * @ingroup public_ledger2_actions
 */

namespace {

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

    eosio::check(total.symbol == _root_govern_symbol,
                 std::string{"migrate: legacy acc "} + std::to_string(acc_it->id) +
                   " имеет неожиданный symbol");

    switch (acc_it->id) {
      case Ledger::accounts::BANK_ACCOUNT:   r.cash  = total; break;   // 51
      case Ledger::accounts::SHARE_FUND:     r.share = total; break;   // 80
      case Ledger::accounts::ENTRANCE_FEES:  r.entry = total; break;   // 861
      default:
        // Все прочие legacy-id в проде нулевые. Ненулевое — сигнал.
        eosio::check(false,
                     std::string{"migrate: неожиданный ненулевой legacy acc id="} +
                       std::to_string(acc_it->id));
    }
  }
  return r;
}

/**
 * Суммирует `blocked` по `progwallets` (soviet, scope=coopname) для program_id.
 */
inline eosio::asset sum_progwallet_blocked(eosio::name coopname, uint64_t program_id) {
  progwallets_index progwallets(_soviet, coopname.value);
  auto byprog = progwallets.get_index<"byprogram"_n>();

  eosio::asset total(0, _root_govern_symbol);

  for (auto it = byprog.lower_bound(program_id); it != byprog.end() && it->program_id == program_id; ++it) {
    if (!it->blocked.has_value()) continue;
    const auto& b = it->blocked.value();
    if (b.amount == 0) continue;
    eosio::check(b.symbol == _root_govern_symbol,
                 std::string{"migrate: progwallet program_id="} + std::to_string(program_id) +
                   " имеет неожиданный symbol");
    total += b;
  }
  return total;
}

/**
 * Возвращает число активных пайщиков (status == "accepted"_n) для кооп.
 * Сначала пытается из кеша cooperative2.active_participants_count.
 */
inline uint64_t count_active_participants(eosio::name coopname, const cooperative2& coop) {
  if (coop.active_participants_count.has_value()) {
    return coop.active_participants_count.value();
  }
  participants_index parts(_soviet, coopname.value);
  uint64_t n = 0;
  for (auto it = parts.begin(); it != parts.end(); ++it) {
    if (it->status == "accepted"_n) ++n;
  }
  return n;
}

/**
 * Отправляет inline apply для одной миграционной операции, если amount > 0.
 * process_hash детерминирован по (coopname, action_code).
 */
inline void send_transit(eosio::name self_name,
                         eosio::name coopname,
                         eosio::name action_code,
                         const eosio::asset& amt) {
  if (amt.amount == 0) return;

  const std::string hash_src =
    std::string{"mig::"} + coopname.to_string() + std::string{"::"} + action_code.to_string();
  const eosio::checksum256 proc_hash = hashit(hash_src);

  Ledger2::apply(
    self_name,
    coopname,
    action_code,
    amt,
    eosio::name{}, // username не применим к транзитной проводке
    proc_hash,
    std::string{"Транзитная миграция остатков legacy → ledger2"}
  );
}

/**
 * Прямой emplace/add в wallets2 БЕЗ бух-проводок. Используется для переноса
 * соwiet::progwallets → wallets2, т.к. progwallets не проводятся через
 * ledger::accounts (параллельная система учёта — двойная запись не нужна
 * и привела бы к двойному учёту на 80).
 */
inline void emplace_wallet_only(eosio::name self_name,
                                eosio::name coopname,
                                uint64_t wallet_id,
                                const eosio::asset& amt) {
  if (amt.amount == 0) return;

  wallets2_index wallets(self_name, coopname.value);
  const auto name_view = ledger2_get_wallet_name_by_id(wallet_id);
  eosio::check(!name_view.empty(),
               std::string{"migrate: unknown wallet id "} + std::to_string(wallet_id));

  auto it = wallets.find(wallet_id);
  if (it == wallets.end()) {
    wallets.emplace(self_name, [&](auto& w) {
      w.id        = wallet_id;
      w.name      = std::string(name_view);
      w.available = amt;
      w.blocked   = eosio::asset(0, amt.symbol);
    });
  } else {
    // Если кошелёк уже создан (например, предыдущим inline apply TRANSIT_*) —
    // просто доливаем сумму в available. Не должно случаться при чистой
    // миграции (9001/10001 не используются базовыми TRANSIT_*), но безопасно.
    wallets.modify(it, self_name, [&](auto& w) { w.available += amt; });
  }
}

/**
 * Мигрирует один кооператив. Отправляет до 4 inline apply (бух-проводки)
 * + прямой emplace программных кошельков (без проводок).
 */
inline void migrate_one_coop(eosio::name self_name, const cooperative2& coop) {
  const eosio::name coopname = coop.username;
  const LegacyBalances b = read_legacy_balances(coopname);

  // Программные кошельки читаем всегда (Благорост + Генератор).
  const eosio::asset blagorost_invest = sum_progwallet_blocked(coopname, 4);  // ЦПП «Благорост»
  const eosio::asset generator_commit = sum_progwallet_blocked(coopname, 3);  // ЦПП «Генератор»

  // Ранний выход: нечего мигрировать (ни legacy, ни программных кошельков).
  if (b.cash.amount == 0 && b.share.amount == 0 && b.entry.amount == 0 &&
      blagorost_invest.amount == 0 && generator_commit.amount == 0) {
    return;
  }

  // ----- A. Бухгалтерский перенос legacy::accounts через 4 TRANSIT_* -----
  if (b.cash.amount > 0 || b.share.amount > 0 || b.entry.amount > 0) {
    // Деньги на паевой фонд: всё на 51 сверх вступительных.
    const eosio::asset share_money(
      b.cash.amount >= b.entry.amount ? b.cash.amount - b.entry.amount : 0,
      _root_govern_symbol
    );
    // Не-денежная часть 80: РИД Восхода (+56M) + всё, что было проведено
    // как имущество через legacy::ledger::add на 80 без prior 51.
    const eosio::asset rid_share(
      b.share.amount >= share_money.amount ? b.share.amount - share_money.amount : 0,
      _root_govern_symbol
    );

    eosio::check(b.cash.amount >= b.entry.amount,
                 std::string{"migrate: entry > cash на кооп "} + coopname.to_string());
    eosio::check(b.share.amount >= share_money.amount,
                 std::string{"migrate: share_money > share_legacy на кооп "} + coopname.to_string());

    // Минимальный паевой: N_active × cooperative.minimum, не больше share_money.
    const uint64_t n_active = count_active_participants(coopname, coop);
    eosio::check(coop.minimum.symbol == _root_govern_symbol,
                 std::string{"migrate: cooperative2.minimum имеет неожиданный symbol на "} +
                   coopname.to_string());
    int64_t min_total_raw = static_cast<int64_t>(n_active) * coop.minimum.amount;
    if (min_total_raw > share_money.amount) min_total_raw = share_money.amount;
    const eosio::asset min_total(min_total_raw, _root_govern_symbol);

    const eosio::asset share_remain(
      share_money.amount - min_total.amount,
      _root_govern_symbol
    );

    send_transit(self_name, coopname, ledger2_ops::TRANSIT_MIN_SHARE, min_total);
    send_transit(self_name, coopname, ledger2_ops::TRANSIT_SHARE,     share_remain);
    send_transit(self_name, coopname, ledger2_ops::TRANSIT_ENTRY,     b.entry);
    send_transit(self_name, coopname, ledger2_ops::TRANSIT_RID,       rid_share);
  }

  // ----- B. Программные кошельки — прямой emplace, без Dr/Cr -----
  // progwallets.blocked НЕ входит в legacy::accounts[80], поэтому
  // проводить их через apply(TRANSIT_BLAGOROST) вызвало бы двойной учёт.
  emplace_wallet_only(self_name, coopname, ledger2_wallets::BLAGOROST_INVEST,   blagorost_invest);
  emplace_wallet_only(self_name, coopname, ledger2_wallets::GENERATOR_COMMIT,   generator_commit);
}

} // namespace

void ledger2::migrate(uint64_t from_coop_index, uint64_t limit) {
  require_auth(get_self());

  ledger2_meta_index meta_tbl(get_self(), get_self().value);
  auto meta_it = meta_tbl.find(0);

  // Полный прогон уже завершён — тихий no-op (Decision #D4 / Story 1.15 AC5).
  if (meta_it != meta_tbl.end() && meta_it->migrated) {
    return;
  }

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

    // Мигрируем только кооперативы (не отделения и не физ. записи).
    if (it->is_cooperative) {
      migrate_one_coop(get_self(), *it);
    }
    ++done;
  }

  if (done == 0 && from_coop_index == 0 && coops.begin() == coops.end()) {
    eosio::check(false, "migrate: таблица cooperatives пуста — повторите после регистрации");
  }

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
