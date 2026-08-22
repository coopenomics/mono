#include <array>

/**
 * @brief Универсальное миграционное действие контракта ledger2 — точка
 * расширения для разовых исправлений состояния, которые можно провести
 * автоматически после деплоя.
 *
 * Содержимое периодически переписывается под текущую задачу миграции, а
 * после её прогона на проде тело очищается до пустого `require_auth(get_self())`
 * (как в `capital::migrate`).
 *
 * Текущая задача (2026-05-24): свёртка `blocked → available` по ВСЕМ коопам.
 *
 * Контекст: механика «заблокированного» баланса упразднена (см.
 * `lib/core/ledger2/operations.hpp` — удалены WalletOp BLOCK/UNBLOCK/BURN_BLOCKED;
 * резерв возврата паевого теперь выражается переводом на кошелёк-резерв
 * `w.wal.wpend`). Поле `blocked` остаётся в таблицах `wallets2`/`userwallets`
 * как deprecated (физическое удаление поля = небезопасная смена layout таблицы
 * на живых коопах, выносится в отдельный cleanup-деплой). Перед тем как поле
 * перестанет поддерживаться кодом, накопленные `blocked`-остатки нужно вернуть
 * в `available`, чтобы средства не «зависли» на упразднённом субсчёте.
 *
 * Действие: пройти всех кооперативов (cooperatives2 в scope registrator) и для
 * каждого свернуть `blocked → available` на уровнях L2 (`wallets2`) и L3
 * (`userwallets`): `available += blocked; blocked = 0`. Сумма средств на кошельке
 * не меняется — только субсчёт.
 *
 * Идемпотентно: после свёртки `blocked == 0`, повторный прогон — no-op.
 *
 * Сигнатура без аргументов — действие вызывается автоматически при деплое
 * контракта (как и прочие задачи migrate); проходит по всем кооперативам сам.
 *
 * ПРЕДУСЛОВИЕ (операционное): на момент прогона не должно быть заявок на возврат
 * «в полёте» (статусы pending/authorized в `wallet::withdraws`) — их `blocked`
 * относится к старой механике и при свёртке в `available` вернётся пайщику как
 * свободные средства, а последующий `completewthd` (BURN с `w.wal.wpend`) не
 * найдёт резерва. Незавершённые заявки нужно довести (complete/decline) ДО
 * деплоя с этой миграцией.
 *
 * @ingroup public_ledger2_actions
 *
 * @note Авторизация требуется от аккаунта: @p ledger2 (get_self()).
 */
void ledger2::migrate() {
  require_auth(get_self());

  cooperatives2_index coops(_registrator, _registrator.value);

  for (auto c = coops.begin(); c != coops.end(); ++c) {
    const eosio::name coopname = c->username;

    // --- L3: userwallets[coopname] ---
    // Модифицируем только не-ключевые поля (available/blocked) — итерация по
    // первичному индексу с modify безопасна (порядок строк не меняется).
    userwallets_index user_wallets(get_self(), coopname.value);
    for (auto it = user_wallets.begin(); it != user_wallets.end(); ++it) {
      if (it->blocked.amount <= 0) continue;
      user_wallets.modify(it, get_self(), [&](auto& r) {
        r.available += r.blocked;
        r.blocked    = eosio::asset(0, r.blocked.symbol);
      });
    }

    // --- L2: wallets2[coopname] ---
    wallets2_index wallets(get_self(), coopname.value);
    for (auto it = wallets.begin(); it != wallets.end(); ++it) {
      if (it->blocked.amount <= 0) continue;
      wallets.modify(it, get_self(), [&](auto& w) {
        w.available += w.blocked;
        w.blocked    = eosio::asset(0, w.blocked.symbol);
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Разовая коррекция СЧЕТОВ под удаление фантомных пайщиков fgrtejiwnynn
  // (инцидент 2026-06-04). Каждый из 6 дублей-аккаунтов при регистрации внёс
  // минимальный паевой 300 RUB (o.reg.putmin: Dr 51 / Cr 80, ISSUE w.reg.minshr).
  // Эти суммы — фантомные (нет реального пайщика), их нужно убрать из паевого
  // фонда и с расчётного счёта. Снимаем L3-доли фантомов на w.reg.minshr,
  // суммируем фактически снятое и ровно на эту сумму уменьшаем L2-кошелёк и
  // бухсчета 80 (Cr) и 51 (Dr). Реальные пайщики (их доли на том же w.reg.minshr
  // и счетах) не затрагиваются — трогаем только перечисленные username.
  //
  // Список синхронизирован с registrator::migrate и soviet::migrate.
  // Идемпотентно: после первого прогона L3-строк фантомов нет → removed == 0 →
  // L2/бухсчета не трогаются (вся коррекция в одной atomic-tx).
  {
    const eosio::name PHANTOM_COOP = "fgrtejiwnynn"_n;
    const std::array<eosio::name, 6> PHANTOMS = {
      "bbsezpgufvmm"_n, "errwcgjwverm"_n, "hcfsluqsfehw"_n,
      "kgkzdadfpzki"_n, "nzuyijobapsv"_n, "tplwfwbujugq"_n,
    };
    const eosio::name MINSHR = ledger2_wallets::MIN_SHARE_FUND; // w.reg.minshr

    eosio::asset removed(0, _root_govern_symbol);

    // 1) Снимаем L3-доли фантомов на w.reg.minshr, суммируем снятое.
    userwallets_index uw(get_self(), PHANTOM_COOP.value);
    auto uw_byuser = uw.get_index<"byuser"_n>();
    for (const auto& u : PHANTOMS) {
      auto it = uw_byuser.lower_bound(u.value);
      while (it != uw_byuser.end() && it->username == u) {
        if (it->wallet_name == MINSHR) {
          removed += it->available + it->blocked;
          it = uw_byuser.erase(it);
        } else {
          ++it;
        }
      }
    }

    if (removed.amount > 0) {
      // 2) L2 w.reg.minshr: available -= removed; удалить кошелёк, если опустел.
      wallets2_index w2(get_self(), PHANTOM_COOP.value);
      auto wit = w2.find(MINSHR.value);
      if (wit != w2.end()) {
        w2.modify(wit, get_self(), [&](auto& w) { w.available -= removed; });
        if (wit->is_empty()) w2.erase(wit);
      }

      // 3) Бухсчета (scope=coopname): Cr 80 (паевой фонд) -= removed,
      //    Dr 51 (расчётный счёт) -= removed; пересчёт сальдо по типу счёта.
      //    Инвариант Σ Dr == Σ Cr сохраняется (обе стороны уменьшены на removed).
      accounts2_index acc(get_self(), PHANTOM_COOP.value);

      auto a80 = acc.find(ledger2_accounts::SHARE_FUND);
      if (a80 != acc.end()) {
        acc.modify(a80, get_self(), [&](auto& a) {
          a.credit_balance -= removed;
          a.balance = account2::compute_balance(a.account_type, a.debit_balance, a.credit_balance);
        });
      }

      auto a51 = acc.find(ledger2_accounts::BANK_ACCOUNT);
      if (a51 != acc.end()) {
        acc.modify(a51, get_self(), [&](auto& a) {
          a.debit_balance -= removed;
          a.balance = account2::compute_balance(a.account_type, a.debit_balance, a.credit_balance);
        });
      }
    }
  }
}
