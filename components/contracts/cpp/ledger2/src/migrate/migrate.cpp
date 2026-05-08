/**
 * @brief Миграция остатков с legacy-ledger на ledger2 (пересмотр 2026-04-20).
 *
 * Разделение на два независимых потока:
 *
 *   A. **Бухгалтерские остатки** из `ledger::accounts` (scope=coopname,
 *      contract=_ledger) → через 4 inline `apply(operations::migration::*)`
 *      с полной двойной проводкой. Счета: 51 / 80 / 86 / 04.
 *
 *   B. **Программные кошельки** из `soviet::progwallets` (scope=coopname,
 *      contract=_soviet) → прямой `wallets2.emplace` в ledger2 БЕЗ
 *      бух-проводок. Legacy::accounts и soviet::progwallets — параллельные
 *      системы учёта, progwallet.blocked не проводится через 80-й счёт,
 *      поэтому любая попытка провести его через Dr 51 / Cr 80 вызовет
 *      двойной учёт на бухуровне. Вместо этого переносим только
 *      wallet-аналитику (w.cap.blago BLAGOROST_FUND, w.cap.gen GENERATOR_FUND — ADR-009).
 *
 * Алгоритм на каждый кооператив:
 *
 *   1. Чтение legacy-счетов (laccounts_index, scope=coopname):
 *        cash_legacy  = account[51].available + .blocked
 *        share_legacy = account[80].available + .blocked
 *        entry_legacy = account[861].available + .blocked
 *
 *   2. Чтение параметров кооператива (cooperative2, scope=_registrator):
 *        coop.minimum     — минимальный паевой для individual / entrepreneur
 *        coop.org_minimum — минимальный паевой для organization (binary_extension)
 *
 *   3. Вычисление распределения:
 *        share_money    = cash_legacy − entry_legacy
 *        min_total      = Σ participant.minimum_amount по accepted-пайщикам
 *                         (фактический зафиксированный минимум каждого пайщика;
 *                          см. compute_min_total_by_type).
 *        share_remain   = share_money − min_total
 *
 *      Инварианты (eosio::check):
 *        cash_legacy   >= entry_legacy
 *        share_legacy  == share_money  (legacy 80 без РИД-части — иначе abort)
 *        min_total     <= share_money  (данные пайщиков сходятся с legacy[80])
 *
 *   4. Отправка 3 inline apply (ненулевые пропускаются):
 *        apply(migration::MIN_SHARE, min_total)    → Dr 51 / Cr 80, MIN_SHARE_FUND   (w.reg.minshr)
 *        apply(migration::SHARE,     share_remain) → Dr 51 / Cr 80, SHARE_FUND_PAY   (w.wal.share)
 *        apply(migration::ENTRY,     entry_legacy) → Dr 51 / Cr 86, ENTRANCE_FEES    (w.reg.entry)
 *
 *   5. Прямой emplace в wallets2 для progwallets (БЕЗ бух-проводок):
 *        Σ progwallet[blagorost].blocked → wallets2[BLAGOROST_FUND  w.cap.blago]
 *        Σ progwallet[generator].blocked → wallets2[GENERATOR_FUND  w.cap.gen]
 *
 *      Если запись wallets2 уже есть (после inline apply сработали) —
 *      aggregate через wallets.modify(available += sum). Иначе — emplace.
 *
 * Курсорный режим: `migrate(from_coop_index, limit)`. Полный прогон —
 * `migrate(0, UINT64_MAX)`. Мета фиксирует `last_migrated_coop_index`.
 *
 * Поле `writeoff` legacy-ledger игнорируется целиком (PRD §4.1.2 FR-L-7).
 *
 * Сборка test mode (IS_TESTNET=1): спец-ветка voskhod ОТКЛЮЧЕНА — voskhod
 * прогоняется по стандартному арифметическому пути наравне с остальными
 * кооперативами. Это нужно, чтобы на тестнете invariant-фейлы (cash≥entry,
 * legacy 80 без РИД-части и т.п.) показывали понятные ошибки, а не маскировались
 * заранее заведёнными суммами. В prod-сборке хардкод по фактам сохраняется.
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
 * Считает суммарный «минимальный паевой» по всем accepted-пайщикам коопа.
 *
 * Берёт ФАКТИЧЕСКИЙ минимум, ЗАФИКСИРОВАННЫЙ на пайщике
 * (`participant.minimum_amount`), а НЕ актуальный coop.minimum/org_minimum.
 * coop.minimum мог быть повышен/понижен после вступления, но реальный взнос
 * пайщика, попавший в legacy::accounts[80], равен `participant.minimum_amount`.
 * Иначе после миграции Σ L3 (по фактическим минимумам) разойдётся с L2,
 * который мы построим по этой сумме.
 *
 * Поле `minimum_amount` — binary_extension; для legacy-записей до выставления
 * этого поля fallback на coop.minimum / coop.org_minimum.
 */
inline eosio::asset compute_min_total_by_type(eosio::name coopname, const cooperative2& coop) {
  eosio::check(coop.minimum.symbol == _root_govern_symbol,
               std::string{"migrate: cooperative2.minimum имеет неожиданный symbol на "} +
                 coopname.to_string());

  const eosio::asset org_min_fallback =
    coop.org_minimum.has_value() ? coop.org_minimum.value() : coop.minimum;
  eosio::check(org_min_fallback.symbol == _root_govern_symbol,
               std::string{"migrate: cooperative2.org_minimum имеет неожиданный symbol на "} +
                 coopname.to_string());

  participants_index parts(_soviet, coopname.value);
  int64_t total_raw = 0;
  for (auto it = parts.begin(); it != parts.end(); ++it) {
    if (it->status != "accepted"_n) continue;

    if (it->minimum_amount.has_value()) {
      const auto& m = it->minimum_amount.value();
      eosio::check(m.symbol == _root_govern_symbol,
                   std::string{"migrate: participant.minimum_amount имеет неожиданный symbol на "} +
                     coopname.to_string() + "/" + it->username.to_string());
      total_raw += m.amount;
    } else {
      // Legacy-запись без зафиксированного minimum_amount: fallback по типу.
      const bool is_org =
        it->type.has_value() && it->type.value() == "organization"_n;
      total_raw += is_org ? org_min_fallback.amount : coop.minimum.amount;
    }
  }

  return eosio::asset(total_raw, _root_govern_symbol);
}

/**
 * Отправляет inline apply для одной миграционной операции, если amount > 0.
 * process_hash детерминирован по (coopname, operation_code).
 */
inline void send_transit(eosio::name self_name,
                         eosio::name coopname,
                         eosio::name operation_code,
                         const eosio::asset& amt) {
  if (amt.amount == 0) return;

  const std::string hash_src =
    std::string{"mig::"} + coopname.to_string() + std::string{"::"} + operation_code.to_string();
  const eosio::checksum256 proc_hash = hashit(hash_src);

  Ledger2::apply(
    self_name,
    coopname,
    operation_code,
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
                                eosio::name wallet_id,
                                const eosio::asset& amt) {
  if (amt.amount == 0) return;

  wallets2_index wallets(self_name, coopname.value);
  const auto human_view = ledger2_get_wallet_human_name(wallet_id);
  eosio::check(!human_view.empty(),
               std::string{"migrate: unknown wallet "} + wallet_id.to_string());

  auto it = wallets.find(wallet_id.value);
  if (it == wallets.end()) {
    wallets.emplace(self_name, [&](auto& w) {
      w.id        = wallet_id;
      w.name      = std::string(human_view);
      w.available = amt;
      w.blocked   = eosio::asset(0, amt.symbol);
    });
  } else {
    // Если кошелёк уже создан (например, предыдущим inline apply TRANSIT_*) —
    // просто доливаем сумму в available. Не должно случаться при чистой
    // миграции (w.cap.blago/w.cap.gen не используются базовыми TRANSIT_*),
    // но безопасно.
    wallets.modify(it, self_name, [&](auto& w) { w.available += amt; });
  }
}

#ifndef IS_TESTNET
/**
 * Спец-ветка миграции для voskhod — РУЧНОЙ ХАРДКОД сумм по кошелькам.
 *
 * Включена только в prod-сборке (без IS_TESTNET). На тестнете voskhod идёт
 * по стандартному арифметическому пути наравне с остальными кооперативами,
 * чтобы любые invariant-несостыковки давали внятную ошибку, а не маскировались
 * заранее заведёнными суммами.
 *
 * Цифры заведены вручную после сверки с фактическими данными mainnet
 * (snapshot 2026-04-29). При необходимости править — править прямо здесь,
 * пересобирать ledger2.wasm и катить.
 *
 * Причина хардкода: legacy::accounts и soviet::progwallets рассинхронизированы
 * (деньги Благороста, прошедшие через 51, разошлись 80 vs progwallets,
 * есть бумажный шлейф на 51, и т.п.). Вместо арифметической сшивки —
 * заводим суммы вручную по тому, как кооператив должен выглядеть в ledger2.
 *
 * Имущественная часть на legacy 80 (РИД ~56.8M) сюда НЕ заводится:
 * она остаётся осадком на legacy 80 до Phase 2 (ADR-009), когда Благорост
 * схлопнется в w.cap.blago и заберёт имущество.
 *
 * Бух-баланс по этой таблице:
 *   Dr 51 = w.reg.minshr + w.wal.share + w.reg.entry  = 31800 + 569900 + 12500 = 614200
 *   Cr 80 = w.reg.minshr + w.wal.share                = 31800 + 569900         = 601700
 *   Cr 86 = w.reg.entry                               = 12500
 *   Σ Dr = Σ Cr = 614200 ✓
 *
 * Σ Благороста на w.cap.blago (57 044 311) и Генератора на w.cap.gen (0) идут
 * прямым emplace без бух-проводок (параллельный progwallets-учёт).
 */
inline void migrate_voskhod_facts(eosio::name self_name, const cooperative2& coop) {
  const eosio::name coopname = coop.username;
  const eosio::symbol sym    = _root_govern_symbol;

  // ┌────────────────────────────────────────────────────────────────────┐
  // │  ТАБЛИЦА МИГРАЦИИ ВОСХОДА — править здесь                          │
  // │  amount задаётся в "копейках" (× 10000), т.к. RUB = 4 знака        │
  // │  31 800.0000 RUB → 318'000'000                                     │
  // └────────────────────────────────────────────────────────────────────┘

  // 1. w.reg.minshr — Минимальные паевые взносы (Dr 51 / Cr 80)
  const eosio::asset W_REG_MINSHR = eosio::asset(    318'000'000LL, sym); //         31 800.0000 RUB

  // 2. w.wal.share  — Цифровой Кошелёк, паевая часть (Dr 51 / Cr 80)
  const eosio::asset W_WAL_SHARE  = eosio::asset(  5'699'000'000LL, sym); //        569 900.0000 RUB

  // 3. w.reg.entry  — Вступительные взносы (Dr 51 / Cr 86)
  const eosio::asset W_REG_ENTRY  = eosio::asset(    125'000'000LL, sym); //         12 500.0000 RUB

  // 4. w.cap.blago  — ЦПП «Благорост» — единый кошелёк программы (emplace, БЕЗ проводок); ADR-009
  const eosio::asset W_CAP_BLAGO  = eosio::asset(570'443'110'000LL, sym); //     57 044 311.0000 RUB

  // 5. w.cap.gen    — ЦПП «Генератор» — единый кошелёк программы (emplace, БЕЗ проводок); 0 → не создаётся
  const eosio::asset W_CAP_GEN    = eosio::asset(              0LL, sym); //              0.0000 RUB

  // ── применяем таблицу ───────────────────────────────────────────────
  send_transit(self_name, coopname, operations::migration::MIN_SHARE, W_REG_MINSHR);
  send_transit(self_name, coopname, operations::migration::SHARE,     W_WAL_SHARE);
  send_transit(self_name, coopname, operations::migration::ENTRY,     W_REG_ENTRY);

  emplace_wallet_only(self_name, coopname, ledger2_wallets::BLAGOROST_FUND,   W_CAP_BLAGO);
  emplace_wallet_only(self_name, coopname, ledger2_wallets::GENERATOR_FUND,   W_CAP_GEN);
}
#endif // !IS_TESTNET

/**
 * Мигрирует один кооператив. Отправляет до 4 inline apply (бух-проводки)
 * + прямой emplace программных кошельков (без проводок).
 *
 * В prod-сборке для voskhod — спец-ветка по фактам (см. migrate_voskhod_facts).
 * В test-сборке (IS_TESTNET=1) спец-ветка отключена — voskhod проходит
 * стандартный арифметический путь, чтобы invariant-фейлы были видимы.
 */
inline void migrate_one_coop(eosio::name self_name, const cooperative2& coop) {
  const eosio::name coopname = coop.username;

#ifndef IS_TESTNET
  // voskhod — особый кейс в prod: переносим по фактическим суммам, не арифметически.
  // В test-сборке этот блок выключен — voskhod идёт по стандартному пути.
  if (coopname == "voskhod"_n) {
    migrate_voskhod_facts(self_name, coop);
    return;
  }
#endif

  const LegacyBalances b = read_legacy_balances(coopname);

  // Программные кошельки читаем всегда (Благорост + Генератор).
  const eosio::asset blagorost_invest = sum_progwallet_blocked(coopname, 4);  // ЦПП «Благорост»
  const eosio::asset generator_commit = sum_progwallet_blocked(coopname, 3);  // ЦПП «Генератор»

  // Ранний выход: нечего мигрировать (ни legacy, ни программных кошельков).
  if (b.cash.amount == 0 && b.share.amount == 0 && b.entry.amount == 0 &&
      blagorost_invest.amount == 0 && generator_commit.amount == 0) {
    return;
  }

  // ----- A. Бухгалтерский перенос legacy::accounts через 3 TRANSIT_* -----
  if (b.cash.amount > 0 || b.share.amount > 0 || b.entry.amount > 0) {
    // Деньги на паевой фонд: всё на 51 сверх вступительных.
    const eosio::asset share_money(
      b.cash.amount >= b.entry.amount ? b.cash.amount - b.entry.amount : 0,
      _root_govern_symbol
    );

    eosio::check(b.cash.amount >= b.entry.amount,
                 std::string{"migrate: entry > cash на кооп "} + coopname.to_string());
    // Инвариант: legacy::accounts[80] (паевой фонд) равен money-части (51 - 86).
    // РИД-часть на legacy 80 не поддерживается этим путём (ADR-009: РИД-программа
    // переезжает в w.cap.blago отдельно); если такой остаток есть — миграция
    // отказывается, кооператив должен закрыть РИД-часть до миграции.
    eosio::check(b.share.amount == share_money.amount,
                 std::string{"migrate: legacy 80 содержит РИД-часть на кооп "} + coopname.to_string() +
                 " — ledger2 не поддерживает РИД-перенос (ADR-009). Закрыть РИД до миграции.");

    // Минимальный паевой: Σ p.minimum_amount по accepted-пайщикам.
    // По конструкции эта сумма равна реальному взносу на legacy[80] и не может
    // превосходить share_money. Если превосходит — данные кооператива
    // не консистентны (например, у кого-то на participant.minimum_amount
    // выставлено больше, чем фактически попало на 80). Падаем явно — пусть
    // оператор разбирается ad-hoc до миграции; clamping мы сознательно НЕ
    // делаем, иначе L2 получится меньше Σ L3 и сломаем инвариант.
    const eosio::asset min_total = compute_min_total_by_type(coopname, coop);
    eosio::check(min_total.amount <= share_money.amount,
                 std::string{"migrate: Σ participant.minimum_amount > share_money на кооп "} +
                   coopname.to_string() + " (Σ min=" + min_total.to_string() +
                   ", share=" + share_money.to_string() +
                   "). Данные кооп-пайщиков не сходятся с legacy[80]; чинить ad-hoc до миграции.");

    const eosio::asset share_remain(
      share_money.amount - min_total.amount,
      _root_govern_symbol
    );

    send_transit(self_name, coopname, operations::migration::MIN_SHARE, min_total);
    send_transit(self_name, coopname, operations::migration::SHARE,     share_remain);
    send_transit(self_name, coopname, operations::migration::ENTRY,     b.entry);
  }

  // ----- B. Программные кошельки — прямой emplace, без Dr/Cr -----
  // progwallets.blocked НЕ входит в legacy::accounts[80], поэтому
  // проводить их через apply(operations::migration::*) вызвало бы двойной учёт.
  emplace_wallet_only(self_name, coopname, ledger2_wallets::BLAGOROST_FUND,   blagorost_invest);
  emplace_wallet_only(self_name, coopname, ledger2_wallets::GENERATOR_FUND,   generator_commit);
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
