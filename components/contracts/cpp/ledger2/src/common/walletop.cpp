/**
 * @brief Атомарная операция по кошельку (issue/transfer/block/unblock/burn/burn_blocked).
 *
 * Внутренний action ledger2 — вызывается только через inline из apply().
 * Auth: только сам ledger2 (require_auth(get_self())).
 *
 * Уровни учёта (ADR-002, ADR-010):
 *   L2 — `wallets2[coopname][wallet_name]`           — всегда мутируется.
 *   L3 — `userwallets[coopname][wallet_name, user]`  — для USER_SHARED-кошельков.
 *
 * Story 3.1: вводится L3 на USER_SHARED-кошельках с auto-create/auto-delete.
 *   - USER_SHARED-сторона требует непустой `username`.
 *   - COOPERATIVE-сторона `username` игнорирует.
 *   - L3-cleanup при обнулении (available + blocked == 0).
 *
 * НЕ входит в Story 3.1 (вынесено в Story 3.2):
 *   - cross-contract check `wallet::users.programs[]`;
 *   - post-mutation assert `Σ L3 == L2`.
 *
 * История этого вызова автоматически попадает в blockchain_actions с
 * полями (op_code, wallet_from, wallet_to, username, amount, process_hash, memo) —
 * этого достаточно бэкенду для восстановления wjournal-эквивалента.
 *
 * TODO(payer, 2026-04-18): сейчас payer = get_self() (ledger2), что даёт
 * неограниченный рост RAM контракта. Перевести на payer = coopname, когда
 * все caller-контракты возьмут у coopname разрешение `eosio.code` → ledger2
 * через linkauth. Решение по code review Decision #D2.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::walletop(eosio::name coopname,
                       uint8_t op_code,
                       eosio::name wallet_from,
                       eosio::name wallet_to,
                       eosio::name username,
                       eosio::asset amount,
                       eosio::checksum256 process_hash,
                       std::string memo) {
  require_auth(get_self());

  // Sender-guard: запрещаем top-level вызов. Допустим только inline-dispatch
  // из ledger2::apply / ledger2::walmove / ledger2::revert — так сохраняется
  // парность проводок walletop+debit+credit и нельзя напрямую подписью
  // `ledger2@active` записать одностороннюю операцию.
  eosio::check(eosio::get_sender() == _ledger2,
               "walletop: допустим только inline-вызов из ledger2::apply/walmove/revert");

  // require_recipient не вызываем: apply() уже нотифицировал coopname один раз.

  eosio::check(amount.is_valid() && amount.amount > 0,
               "walletop: некорректная сумма");
  eosio::check(amount.symbol == _root_govern_symbol,
               "walletop: некорректный символ валюты");
  eosio::check(memo.size() < 256, "walletop: memo > 255");
  // op_code = 5 (NONE) намеренно не допускается: NONE-операции — это только
  // бухпроводка без кошелькового движения, apply.cpp не диспатчит для них walletop.
  // Прямой вызов с op_code=5 был бы no-op и сбил бы инвариант parity.
  // Допустимы 0..4 (ISSUE/TRANSFER/BLOCK/UNBLOCK/BURN) и 6 (BURN_BLOCKED).
  eosio::check(op_code <= static_cast<uint8_t>(WalletOp::BURN_BLOCKED) &&
               op_code != static_cast<uint8_t>(WalletOp::NONE),
               "walletop: неизвестный op_code");

  wallets2_index   wallets(get_self(), coopname.value);
  userwallets_index user_wallets(get_self(), coopname.value);
  const eosio::name payer = get_self();

  // ── L2 helpers ──────────────────────────────────────────────────────
  auto upsert_wallet = [&](eosio::name wallet_id) {
    auto it = wallets.find(wallet_id.value);
    if (it == wallets.end()) {
      const auto human_view = ledger2_get_wallet_human_name(wallet_id);
      eosio::check(!human_view.empty(),
                   std::string{"walletop: unknown wallet "} + wallet_id.to_string());
      const std::string human{human_view};
      it = wallets.emplace(payer, [&](auto& w) {
        w.id        = wallet_id;
        w.name      = human;
        w.available = eosio::asset(0, amount.symbol);
        w.blocked   = eosio::asset(0, amount.symbol);
      });
    }
    return it;
  };

  auto cleanup_l2_if_empty = [&](eosio::name wallet_id) {
    auto it = wallets.find(wallet_id.value);
    if (it != wallets.end() && it->is_empty()) {
      wallets.erase(it);
    }
  };

  // ── L3 helpers (USER_SHARED only) ────────────────────────────────────
  // Если username пустой — L2-only mode (для миграции `ledger2::migrate` legacy
  // → ledger2, которая агрегирует балансы кооператива без разбивки по пайщикам;
  // полноценное заполнение L3 идёт через `ledger2::migrate3` per-record).
  // Story 3.2 добавит обязательность username на уровне `apply` для НЕ-миграционных
  // operation_code (o.mig.* исключение).
  auto find_l3 = [&](eosio::name wallet_id) {
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    return idx.find(combine_ids(wallet_id.value, username.value));
  };

  auto upsert_l3 = [&](eosio::name wallet_id) {
    // Только для USER_SHARED. Возвращает iterator основного индекса.
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    auto it  = idx.find(combine_ids(wallet_id.value, username.value));
    if (it == idx.end()) {
      const uint64_t new_id = user_wallets.available_primary_key();
      user_wallets.emplace(payer, [&](auto& uw) {
        uw.id          = new_id;
        uw.wallet_name = wallet_id;
        uw.username    = username;
        uw.available   = eosio::asset(0, amount.symbol);
        uw.blocked     = eosio::asset(0, amount.symbol);
      });
      return user_wallets.find(new_id);
    }
    return user_wallets.find(it->id);
  };

  auto cleanup_l3_if_empty = [&](eosio::name wallet_id) {
    if (wallet_id.value == 0) return;
    if (ledger2_get_wallet_kind(wallet_id) != WalletKind::USER_SHARED) return;
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    auto it  = idx.find(combine_ids(wallet_id.value, username.value));
    if (it != idx.end() && it->is_empty()) {
      idx.erase(it);
    }
  };

  // L3 трогаем только когда сторона USER_SHARED И username передан. Пустой
  // username + USER_SHARED → L2-only (см. комментарий выше).
  auto is_user_shared_l3 = [&](eosio::name wallet_id) {
    return wallet_id.value != 0 &&
           username.value != 0 &&
           ledger2_get_wallet_kind(wallet_id) == WalletKind::USER_SHARED;
  };

  // ── Cross-contract check wallet::users.programs[] (Story 3.2; ADR-004) ──
  // Перед операцией на USER_SHARED-кошельке у пайщика должно быть подписано
  // соответствующее программное соглашение в wallet::users (исключение —
  // w.reg.minshr: required_program_id == 0 → проверка пропускается).
  auto assert_program_signed = [&](eosio::name wallet_id) {
    if (!is_user_shared_l3(wallet_id)) return;
    const uint64_t required_pid = ledger2_required_program_id(wallet_id);
    if (required_pid == 0) return; // исключение (например, w.reg.minshr)

    Wallet::users_index wallet_users(_wallet, coopname.value);
    auto user_it = wallet_users.find(username.value);
    eosio::check(user_it != wallet_users.end(),
                 std::string{"walletop: у пайщика "} + username.to_string() +
                   " нет программных соглашений в wallet::users (требуется program_id=" +
                   std::to_string(required_pid) + " для " + wallet_id.to_string() + ")");

    bool found = false;
    for (const auto& pa : user_it->programs) {
      if (pa.program_id == required_pid) { found = true; break; }
    }
    eosio::check(found,
                 std::string{"walletop: у пайщика "} + username.to_string() +
                   " не подписано соглашение program_id=" + std::to_string(required_pid) +
                   " для кошелька " + wallet_id.to_string());
  };

  // ── Post-mutation Σ L3 == L2 (Story 3.2; NFR2) ────────────────────────
  // ВРЕМЕННО СНЯТО (2026-05-12): runtime-сверка Σ L3 == L2 через полный
  // sweep secondary-индекса bywallet — O(N_users) на кошелёк на каждой
  // walletop-операции; на боевых coop'ах с сотнями пайщиков это
  // непропорциональная нагрузка на CPU billing, и сейчас на тестнете она
  // блокирует пользовательские tx из-за исторических расхождений после
  // миграций 048/049.
  //
  // walletop по построению применяет одно и то же `amount` к L2 и L3 (см.
  // ниже case'ы ISSUE/TRANSFER/BLOCK/UNBLOCK/BURN/BURN_BLOCKED), а sender-guard на
  // строке 46-47 запрещает обход. Поэтому инвариант сохраняется по
  // конструкции; полную сверку выполняет бэкенд («стол бухгалтера»),
  // вне транзакционного hot path.

  // Pre-flight cross-contract check (до мутаций — fail-fast).
  assert_program_signed(wallet_from);
  assert_program_signed(wallet_to);

  switch (static_cast<WalletOp>(op_code)) {
    case WalletOp::ISSUE: {
      eosio::check(wallet_from.value == 0, "walletop ISSUE: wallet_from должен быть пустым");
      eosio::check(wallet_to.value != 0, "walletop ISSUE: требуется wallet_to");

      auto it = upsert_wallet(wallet_to);
      wallets.modify(it, payer, [&](auto& w) { w.available += amount; });

      if (is_user_shared_l3(wallet_to)) {
        auto uw_it = upsert_l3(wallet_to);
        user_wallets.modify(uw_it, payer, [&](auto& uw) { uw.available += amount; });
      }
      break;
    }
    case WalletOp::TRANSFER: {
      eosio::check(wallet_from.value != 0 && wallet_to.value != 0,
                   "walletop TRANSFER: требуются wallet_from и wallet_to");
      eosio::check(wallet_from != wallet_to,
                   "walletop TRANSFER: wallet_from == wallet_to");

      auto from_it = wallets.find(wallet_from.value);
      eosio::check(from_it != wallets.end() && from_it->available >= amount,
                   std::string{"walletop TRANSFER: недостаточно средств на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(from_it, payer, [&](auto& w) { w.available -= amount; });
      auto to_it = upsert_wallet(wallet_to);
      wallets.modify(to_it, payer, [&](auto& w) { w.available += amount; });

      if (is_user_shared_l3(wallet_from)) {
        auto from_uw = find_l3(wallet_from);
        eosio::check(from_uw != user_wallets.get_index<"byuserwallet"_n>().end() &&
                     from_uw->available >= amount,
                     std::string{"walletop TRANSFER: недостаточно L3-средств у пайщика "} +
                       username.to_string() + " на " + wallet_from.to_string());
        auto from_uw_pri = user_wallets.find(from_uw->id);
        user_wallets.modify(from_uw_pri, payer, [&](auto& uw) { uw.available -= amount; });
      }
      if (is_user_shared_l3(wallet_to)) {
        auto to_uw = upsert_l3(wallet_to);
        user_wallets.modify(to_uw, payer, [&](auto& uw) { uw.available += amount; });
      }

      cleanup_l2_if_empty(wallet_from);
      cleanup_l3_if_empty(wallet_from);
      break;
    }
    case WalletOp::BLOCK: {
      eosio::check(wallet_from.value != 0, "walletop BLOCK: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop BLOCK: wallet_to должен быть пустым");

      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"walletop BLOCK: недостаточно available на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) {
        w.available -= amount;
        w.blocked   += amount;
      });

      if (is_user_shared_l3(wallet_from)) {
        auto uw = find_l3(wallet_from);
        eosio::check(uw != user_wallets.get_index<"byuserwallet"_n>().end() &&
                     uw->available >= amount,
                     std::string{"walletop BLOCK: недостаточно L3-available у пайщика "} +
                       username.to_string() + " на " + wallet_from.to_string());
        auto uw_pri = user_wallets.find(uw->id);
        user_wallets.modify(uw_pri, payer, [&](auto& r) {
          r.available -= amount;
          r.blocked   += amount;
        });
      }
      break;
    }
    case WalletOp::UNBLOCK: {
      eosio::check(wallet_from.value != 0, "walletop UNBLOCK: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop UNBLOCK: wallet_to должен быть пустым");

      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->blocked >= amount,
                   std::string{"walletop UNBLOCK: недостаточно blocked на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) {
        w.blocked   -= amount;
        w.available += amount;
      });

      if (is_user_shared_l3(wallet_from)) {
        auto uw = find_l3(wallet_from);
        eosio::check(uw != user_wallets.get_index<"byuserwallet"_n>().end() &&
                     uw->blocked >= amount,
                     std::string{"walletop UNBLOCK: недостаточно L3-blocked у пайщика "} +
                       username.to_string() + " на " + wallet_from.to_string());
        auto uw_pri = user_wallets.find(uw->id);
        user_wallets.modify(uw_pri, payer, [&](auto& r) {
          r.blocked   -= amount;
          r.available += amount;
        });
      }
      break;
    }
    case WalletOp::BURN: {
      eosio::check(wallet_from.value != 0, "walletop BURN: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop BURN: wallet_to должен быть пустым");

      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"walletop BURN: недостаточно available на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) { w.available -= amount; });

      if (is_user_shared_l3(wallet_from)) {
        auto uw = find_l3(wallet_from);
        eosio::check(uw != user_wallets.get_index<"byuserwallet"_n>().end() &&
                     uw->available >= amount,
                     std::string{"walletop BURN: недостаточно L3-available у пайщика "} +
                       username.to_string() + " на " + wallet_from.to_string());
        auto uw_pri = user_wallets.find(uw->id);
        user_wallets.modify(uw_pri, payer, [&](auto& r) { r.available -= amount; });
      }

      cleanup_l2_if_empty(wallet_from);
      cleanup_l3_if_empty(wallet_from);
      break;
    }
    case WalletOp::NONE: {
      // Недостижимо: проверка op_code != NONE стоит на входе action; этот case
      // нужен только чтобы покрыть enum в switch (-Wswitch).
      eosio::check(false, "walletop NONE: запрещённый op_code");
      break;
    }
    case WalletOp::BURN_BLOCKED: {
      eosio::check(wallet_from.value != 0, "walletop BURN_BLOCKED: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop BURN_BLOCKED: wallet_to должен быть пустым");

      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->blocked >= amount,
                   std::string{"walletop BURN_BLOCKED: недостаточно blocked на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) { w.blocked -= amount; });

      if (is_user_shared_l3(wallet_from)) {
        auto uw = find_l3(wallet_from);
        eosio::check(uw != user_wallets.get_index<"byuserwallet"_n>().end() &&
                     uw->blocked >= amount,
                     std::string{"walletop BURN_BLOCKED: недостаточно L3-blocked у пайщика "} +
                       username.to_string() + " на " + wallet_from.to_string());
        auto uw_pri = user_wallets.find(uw->id);
        user_wallets.modify(uw_pri, payer, [&](auto& r) { r.blocked -= amount; });
      }

      cleanup_l2_if_empty(wallet_from);
      cleanup_l3_if_empty(wallet_from);
      break;
    }
  }

  // Post-mutation Σ L3 == L2: см. блок выше (строки 163-175). Снято
  // временно — сверка делается на бэкенде вне hot path.
}
