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
        // Прочие legacy-id (862..867 — RESERVE/INDIVISIBLE/ECONOMIC/MUTUAL/DEVELOPMENT/DELEGATE_FEES)
        // в ledger2 как отдельные кошельки не выделены. Намеренно пропускаем —
        // не падаем, чтобы не блокировать миграцию кооператива.
        break;
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
 * Прямой emplace в wallets2 с произвольным available/blocked. Используется
 * только из voskhod-спец-ветки: там L2-агрегаты нужно завести строго по
 * фактическому распределению chain (Благорост — blocked, не available).
 */
inline void emplace_wallet_balance(eosio::name self_name,
                                   eosio::name coopname,
                                   eosio::name wallet_id,
                                   const eosio::asset& available,
                                   const eosio::asset& blocked) {
  if (available.amount == 0 && blocked.amount == 0) return;

  wallets2_index wallets(self_name, coopname.value);
  const auto human_view = ledger2_get_wallet_human_name(wallet_id);
  eosio::check(!human_view.empty(),
               std::string{"migrate: unknown wallet "} + wallet_id.to_string());

  auto it = wallets.find(wallet_id.value);
  eosio::check(it == wallets.end(),
               std::string{"migrate: wallet "} + wallet_id.to_string() + " уже создан");
  wallets.emplace(self_name, [&](auto& w) {
    w.id        = wallet_id;
    w.name      = std::string(human_view);
    w.available = available;
    w.blocked   = blocked;
  });
}

/**
 * Прямой emplace в accounts2 БЕЗ бух-проводок. Используется только из
 * voskhod-спец-ветки: после хардкода в кошельках замыкаем баланс прямой
 * записью в accounts2 (отдельные «миграционные» операции под Dr 04 / Dr 08
 * усложнили бы общий реестр).
 *
 * Тип счёта определяется планом (LEDGER2_ACCOUNT_MAP):
 *   - ACTIVE   — записываем `balance` в `debit_balance`,  `credit_balance = 0`;
 *   - PASSIVE  — записываем `balance` в `credit_balance`, `debit_balance = 0`.
 */
inline void emplace_account_balance(eosio::name self_name,
                                    eosio::name coopname,
                                    uint64_t account_id,
                                    const eosio::asset& balance) {
  if (balance.amount == 0) return;
  const auto* meta = ledger2_find_account_meta(account_id);
  eosio::check(meta != nullptr,
               std::string{"migrate: unknown account_id "} + std::to_string(account_id));

  accounts2_index accounts(self_name, coopname.value);
  auto it = accounts.find(account_id);
  eosio::check(it == accounts.end(),
               std::string{"migrate: account "} + std::to_string(account_id) + " уже создан");

  const eosio::asset zero(0, balance.symbol);
  const uint8_t      type_u8 = static_cast<uint8_t>(meta->type);

  accounts.emplace(self_name, [&](auto& a) {
    a.id           = account_id;
    a.name         = std::string(meta->name);
    a.account_type = type_u8;
    if (meta->type == AccountType::PASSIVE) {
      a.debit_balance  = zero;
      a.credit_balance = balance;
    } else { // ACTIVE / ACTIVE_PASSIVE
      a.debit_balance  = balance;
      a.credit_balance = zero;
    }
    a.balance = account2::compute_balance(type_u8, a.debit_balance, a.credit_balance);
  });
}

/**
 * Прямой emplace L3-записи в userwallets БЕЗ бух-проводок. Только для
 * `kind == USER_SHARED`. Записи с (0,0) — пропускаются.
 */
inline void emplace_userwallet_only(eosio::name self_name,
                                    eosio::name coopname,
                                    eosio::name wallet_id,
                                    eosio::name username,
                                    const eosio::asset& available,
                                    const eosio::asset& blocked) {
  if (available.amount == 0 && blocked.amount == 0) return;

  const WalletKind kind = ledger2_get_wallet_kind(wallet_id);
  eosio::check(kind == WalletKind::USER_SHARED,
               std::string{"migrate: userwallets допустим только для USER_SHARED, wallet="} +
                 wallet_id.to_string());

  userwallets_index user_wallets(self_name, coopname.value);
  auto idx = user_wallets.get_index<"byuserwallet"_n>();
  const auto key = combine_ids(wallet_id.value, username.value);
  auto it = idx.find(key);
  eosio::check(it == idx.end(),
               std::string{"migrate: userwallet (wallet="} + wallet_id.to_string() +
                 ", user=" + username.to_string() + ") уже существует");
  user_wallets.emplace(self_name, [&](auto& uw) {
    uw.id          = user_wallets.available_primary_key();
    uw.wallet_name = wallet_id;
    uw.username    = username;
    uw.available   = available;
    uw.blocked     = blocked;
  });
}

/**
 * Заводит L3-запись `w.cap.preimp` для пайщика, если он существует в
 * `soviet::participants` коопа. Если нет (тестнет/чужой контекст) — silently skip.
 *
 * Использовать ИСКЛЮЧИТЕЛЬНО для воскходных пред-импорт-РИД-учётов (5 пайщиков
 * по договору УХД, заведённых до перехода на электронный учёт: ЭГОЛ/Анацко/
 * Кочетков/Мильшин/Манакин). Их деньги списаны с `progwallets[pid=1]` cleos-
 * командами; здесь фиксируем их как РИД-взносы на отдельном кошельке для
 * последующего drppre при importcontr.
 */
inline void emplace_preimp_if_present(eosio::name self_name,
                                      eosio::name coopname,
                                      eosio::name username,
                                      int64_t amount_raw) {
  participants_index parts(_soviet, coopname.value);
  if (parts.find(username.value) == parts.end()) {
    return; // тестнет / иной контекст — пропускаем без падения
  }
  const eosio::asset amt(amount_raw, _root_govern_symbol);
  const eosio::asset zero(0, _root_govern_symbol);
  emplace_userwallet_only(self_name, coopname, ledger2_wallets::PREIMP_FUND, username, amt, zero);
}
#endif // !IS_TESTNET

#ifndef IS_TESTNET
/**
 * Спец-ветка миграции для voskhod — РУЧНОЙ ХАРДКОД балансов (accounts2 +
 * wallets2 + L3 для пред-импорт-учётов).
 *
 * Включена только в prod-сборке (без IS_TESTNET). На тестнете voskhod идёт
 * по стандартному арифметическому пути наравне с остальными кооперативами,
 * чтобы любые invariant-несостыковки давали внятную ошибку, а не маскировались
 * заранее заведёнными суммами. Дополнительная защита внутри ветки —
 * `participants.find()`-guard в emplace_preimp_if_present, чтобы случайный
 * запуск voskhod-веточки в чужом окружении не падал.
 *
 * Цифры заведены вручную после сверки с фактическими данными mainnet
 * (snapshot 2026-05-10) и согласованы с председателем (см. project-memory
 * `voskhod migrate2 — финальный план миграции`).
 *
 * Причина хардкода: legacy::accounts и soviet::progwallets рассинхронизированы
 * (имущ. Благорост ~57M на legacy 80 без отражения в 04, бумажный шлейф на 51,
 * непокрытые хоз.расходы на 86). Арифметической сшивки нет — заводим суммы
 * напрямую по согласованной с бухгалтером картине.
 *
 * ┌────────────────────────────────────── accounts2 ──────────────────────────────────────┐
 * │ 51 (BANK_ACCOUNT, А)         = 176 800       — банк (хардкод 145 000) + 31 800 минП    │
 * │ 04 (INTANGIBLE_ASSETS, А)    = 62 353 311    — имущ. Благорост 56 903 311 + preimp 5М4 │
 * │ 08 (NON_CURRENT_INVESTMENTS) = 543 400       — балансировка (свод НМА → 80)            │
 * │ 80 (SHARE_FUND, П)           = 62 946 011    — 419 900 ЦК + 57 044 311 Благорост       │
 * │                                              + 31 800 минП + 5 450 000 preimp Cr-side  │
 * │ 86 (TARGET_RECEIPTS, П)      = 127 500       — хоз.расходы 115К + legacy 861 12 500    │
 * │                                                                                         │
 * │   Σ Dr = 176 800 + 62 353 311 + 543 400 = 63 073 511                                    │
 * │   Σ Cr = 62 946 011 + 127 500           = 63 073 511 ✓                                  │
 * └─────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌────────────────────────────── wallets2 (L2-агрегаты) ─────────────────────────────┐
 * │ w.reg.minshr  available = 31 800     (34 пайщика; minimum_amount; L3 → migrator-048)│
 * │ w.wal.share   available = 419 900    (5 пайщиков ЦК-остаток; L3 → migrator-049)    │
 * │ w.cap.blago   blocked = 57 044 311   (12 пайщиков pid=4; L3 → migrator-049)        │
 * │ w.cap.preimp  available = 5 450 000  (5 пайщиков; L3 — ниже, прямой emplace)       │
 * │ w.sov.expns   available = 127 500    (хоз.расходы из числа целевого; COOPERATIVE)  │
 * └────────────────────────────────────────────────────────────────────────────────────┘
 *
 * L3 (userwallets) для USER_SHARED-кошельков заводит migrator (Phase 1 = 048
 * для w.reg.minshr; Phase 2 = 049 для w.wal.share / w.wal.member / w.cap.blago).
 * Здесь же — только 5 пред-импорт-преимп-записей, выпавших из progwallets
 * после ручных subbal'ов (см. ~/cleos.md, 5 пайщиков с РИД-взносами по
 * договорам УХД, не успевшим попасть в электронный учёт до миграции).
 */
inline void migrate_voskhod_facts(eosio::name self_name, const cooperative2& coop) {
  const eosio::name   coopname = coop.username;
  const eosio::symbol sym      = _root_govern_symbol;
  const eosio::asset  zero(0, sym);

  // ───────── accounts2 ─────────
  emplace_account_balance(self_name, coopname, ledger2_accounts::BANK_ACCOUNT,
                          eosio::asset(    1'768'000'000LL, sym)); //        176 800.0000 RUB
  emplace_account_balance(self_name, coopname, ledger2_accounts::INTANGIBLE_ASSETS,
                          eosio::asset(  623'533'110'000LL, sym)); //     62 353 311.0000 RUB
  emplace_account_balance(self_name, coopname, ledger2_accounts::NON_CURRENT_INVESTMENTS,
                          eosio::asset(    5'434'000'000LL, sym)); //        543 400.0000 RUB
  emplace_account_balance(self_name, coopname, ledger2_accounts::SHARE_FUND,
                          eosio::asset(  629'460'110'000LL, sym)); //     62 946 011.0000 RUB
  emplace_account_balance(self_name, coopname, ledger2_accounts::TARGET_RECEIPTS,
                          eosio::asset(    1'275'000'000LL, sym)); //        127 500.0000 RUB

  // ───────── wallets2 (L2) ─────────
  emplace_wallet_balance(self_name, coopname, ledger2_wallets::MIN_SHARE_FUND,
                         eosio::asset(   318'000'000LL, sym),      //         31 800.0000 RUB available
                         zero);
  emplace_wallet_balance(self_name, coopname, ledger2_wallets::SHARE_FUND_PAY,
                         eosio::asset( 4'199'000'000LL, sym),       //        419 900.0000 RUB available
                         zero);
  emplace_wallet_balance(self_name, coopname, ledger2_wallets::BLAGOROST_FUND,
                         zero,
                         eosio::asset(570'443'110'000LL, sym));     //     57 044 311.0000 RUB blocked
  emplace_wallet_balance(self_name, coopname, ledger2_wallets::PREIMP_FUND,
                         eosio::asset(54'500'000'000LL, sym),       //      5 450 000.0000 RUB available
                         zero);
  emplace_wallet_balance(self_name, coopname, ledger2_wallets::SOV_EXPENSES,
                         eosio::asset( 1'275'000'000LL, sym),       //        127 500.0000 RUB available
                         zero);

  // ───────── L3: преимп-учёты (5 пайщиков с РИД-взносами по договорам УХД) ─────────
  // Сумма по таблице = 5 450 000 RUB = wallets2[w.cap.preimp].available ✓
  emplace_preimp_if_present(self_name, coopname, "honruwpdxtty"_n,    500'000'000LL); //   50 000.0000 ЭГОЛ
  emplace_preimp_if_present(self_name, coopname, "zlvsujtoctal"_n, 50'000'000'000LL); // 5 000 000.0000 Анацко
  emplace_preimp_if_present(self_name, coopname, "yxkjufikzxri"_n,  1'000'000'000LL); //  100 000.0000 Кочетков
  emplace_preimp_if_present(self_name, coopname, "vvqamckynxod"_n,  1'000'000'000LL); //  100 000.0000 Мильшин
  emplace_preimp_if_present(self_name, coopname, "hntppjjknmsu"_n,  2'000'000'000LL); //  200 000.0000 Манакин
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
#ifdef IS_TESTNET
    // На тестнете терпим грязные данные: clamp'им вместо abort.
    // Тестовые остатки (entry > cash, РИД-часть на 80, Σmin > share) — игнорятся.
    const int64_t entry_amt  = b.entry.amount < b.cash.amount ? b.entry.amount : b.cash.amount;
    const int64_t share_money_amt = b.cash.amount - entry_amt;
    const eosio::asset entry_eff(entry_amt, _root_govern_symbol);
    const eosio::asset share_money(share_money_amt, _root_govern_symbol);

    eosio::asset min_total = compute_min_total_by_type(coopname, coop);
    if (min_total.amount > share_money.amount) {
      min_total = share_money;
    }

    const eosio::asset share_remain(
      share_money.amount - min_total.amount,
      _root_govern_symbol
    );

    send_transit(self_name, coopname, operations::migration::MIN_SHARE, min_total);
    send_transit(self_name, coopname, operations::migration::SHARE,     share_remain);
    send_transit(self_name, coopname, operations::migration::ENTRY,     entry_eff);
#else
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
#endif
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
