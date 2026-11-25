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
 * Текущая задача (2026-11-05, 99D-26): списание с кошелька фонда
 * обеспечения хозяйственной деятельности расходов, произведённых до
 * цифрового учёта, — блок в конце действия. Прежние задачи ниже идемпотентны и оставлены.
 *
 * Задача 2026-05-24: свёртка `blocked → available` по ВСЕМ коопам.
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
      user_wallets.modify(it, RamPayer::of(user_wallets), [&](auto& r) {
        r.available += r.blocked;
        r.blocked    = eosio::asset(0, r.blocked.symbol);
      });
    }

    // --- L2: wallets2[coopname] ---
    wallets2_index wallets(get_self(), coopname.value);
    for (auto it = wallets.begin(); it != wallets.end(); ++it) {
      if (it->blocked.amount <= 0) continue;
      wallets.modify(it, RamPayer::of(wallets), [&](auto& w) {
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
        w2.modify(wit, RamPayer::of(w2), [&](auto& w) { w.available -= removed; });
        if (wit->is_empty()) w2.erase(wit);
      }

      // 3) Бухсчета (scope=coopname): Cr 80 (паевой фонд) -= removed,
      //    Dr 51 (расчётный счёт) -= removed; пересчёт сальдо по типу счёта.
      //    Инвариант Σ Dr == Σ Cr сохраняется (обе стороны уменьшены на removed).
      accounts2_index acc(get_self(), PHANTOM_COOP.value);

      auto a80 = acc.find(ledger2_accounts::SHARE_FUND);
      if (a80 != acc.end()) {
        acc.modify(a80, RamPayer::of(acc), [&](auto& a) {
          a.credit_balance -= removed;
          a.balance = account2::compute_balance(a.account_type, a.debit_balance, a.credit_balance);
        });
      }

      auto a51 = acc.find(ledger2_accounts::BANK_ACCOUNT);
      if (a51 != acc.end()) {
        acc.modify(a51, RamPayer::of(acc), [&](auto& a) {
          a.debit_balance -= removed;
          a.balance = account2::compute_balance(a.account_type, a.debit_balance, a.credit_balance);
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Фонд обеспечения хозяйственной деятельности — только транзит (задача
  // 99D-26, решение владельца 05.11.2026). Хардкод-миграция 10.05.2026 внесла
  // на кошелёк фонда w.sov.expns остаток 127 500 ₽ (voskhod): хозяйственные
  // расходы 115 000 ₽ и вступительные старой книги 12 500 ₽, уже потраченные
  // вне цифровой системы. Счета миграции сведены с бухгалтером и остаются как
  // есть; остатком на кошельке эти деньги лежать не должны. Остаток сжигается
  // операцией o.mig.spent без проводки — след расхода остаётся в истории фонда.
  // Идемпотентно: после списания остаток фонда ноль, а новые расходы его не
  // оставляют — транзит сводится в той же транзакции.
  for (auto c = coops.begin(); c != coops.end(); ++c) {
    // apply принимает только действующий кооператив — прочие пропускаем, чтобы
    // их строка не уронила миграцию всех остальных на раскатке.
    if (!c->is_coop() || !c->status.has_value() || c->status.value() != "active"_n) continue;
    const eosio::name coopname = c->username;
    wallets2_index wallets(get_self(), coopname.value);
    auto fund = wallets.find(ledger2_wallets::SOV_EXPENSES.value);
    if (fund == wallets.end() || fund->available.amount <= 0) continue;

    const std::string seed = std::string{"ledger2:migrate:sov.spent:"} + coopname.to_string();
    Ledger2::apply(get_self(), coopname,
                   operations::migration::SPENT,
                   processes::migration::TRANSIT,
                   fund->available, coopname,
                   eosio::sha256(seed.data(), seed.size()),
                   "Хозяйственные расходы, произведённые до цифрового учёта (миграция 10.05.2026, сверено с бухгалтером)");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Минимальные паевые взносы ранних пайщиков — на личные кошельки (C28-42,
  // 09.11.2026).
  //
  // При переходе ВОСХОДа на ledger2 (migrate_voskhod_facts, 13.05.2026)
  // минимальные взносы 34 пайщиков, принятых до перехода, легли общей суммой на
  // кооперативный кошелёк w.sov.mnused («использованные минимальные паевые
  // взносы»: деньги к тому времени вложены в активы, счёт 08) — без личных
  // строк. Долг перед пайщиками остался на счёте 80, а выход его не видел:
  // registrator::confirmexit возвращает минимальный взнос только с личной строки
  // w.reg.minshr, и у этих пайщиков он молча не возвращался бы. Пайщики,
  // принятые после перехода, получают личную строку при приёме (o.reg.setmin).
  //
  // Приводим ранних пайщиков к тому же виду: личная строка w.reg.minshr на сумму
  // взноса из реестра совета (minimum_amount — сумма, внесённая при приёме), и
  // ровно столько же переносится с w.sov.mnused на w.reg.minshr на уровне
  // кошельков кооператива. Проводок нет: обязательство уже стоит на счёте 80,
  // меняется только разбивка по пайщикам; Σ L3 == L2 у w.reg.minshr сохраняется.
  //
  // Кого переносим — всё сразу:
  //   • пайщик принят советом (accepted) до перехода на ledger2;
  //   • личной строки w.reg.minshr у него нет;
  //   • выхода в работе нет: confirmexit уже снял строку на главный паевой, и
  //     повторное заведение вернуло бы взнос дважды;
  //   • сумма помещается в остаток w.sov.mnused — переносим только то, что лежит
  //     на кошельке, и никогда не уводим его в минус.
  // Тестовый пайщик hwpzzazaupgh денег не вносил и исключён (список
  // синхронизирован с registrator::migrate и soviet::migrate); его 300 RUB
  // остаются на w.sov.mnused без проводок — решение председателя.
  //
  // Кооператив без w.sov.mnused не затрагивается (на всех сетях, кроме боевого
  // ВОСХОДа, кошелька нет). Перебор реестра — разовая работа раскатки, пайщиков
  // в кооперативе десятки. Идемпотентно: перенесённые получают строку и больше
  // под условие не попадают.
  {
    const eosio::name MINSHR = ledger2_wallets::MIN_SHARE_FUND;  // w.reg.minshr
    const eosio::name MNUSED = ledger2_wallets::MIN_SHARE_USED;  // w.sov.mnused
    const eosio::name TEST_PARTICIPANT = "hwpzzazaupgh"_n;
    // Переход ВОСХОДа на ledger2: 13.05.2026 00:00 UTC.
    const eosio::time_point_sec LEDGER2_SWITCH(1778630400);

    for (auto c = coops.begin(); c != coops.end(); ++c) {
      const eosio::name coopname = c->username;

      wallets2_index wallets(get_self(), coopname.value);
      auto mnused = wallets.find(MNUSED.value);
      if (mnused == wallets.end() || mnused->available.amount <= 0) continue;

      eosio::asset remaining = mnused->available;
      eosio::asset moved(0, remaining.symbol);

      userwallets_index user_wallets(get_self(), coopname.value);
      auto by_userwallet = user_wallets.get_index<"byuserwallet"_n>();
      participants_index participants(_soviet, coopname.value);
      Registrator::exits_index exits(_registrator, coopname.value);

      for (auto p = participants.begin(); p != participants.end(); ++p) {
        if (p->username == TEST_PARTICIPANT) continue;
        if (!p->is_active() || p->created_at >= LEDGER2_SWITCH) continue;
        if (!p->minimum_amount.has_value()) continue;

        const eosio::asset amount = p->minimum_amount.value();
        if (amount.amount <= 0 || amount.symbol != remaining.symbol || amount > remaining) continue;
        if (exits.find(p->username.value) != exits.end()) continue;
        if (by_userwallet.find(combine_ids(MINSHR.value, p->username.value)) != by_userwallet.end()) continue;

        const uint64_t new_id = user_wallets.available_primary_key();
        user_wallets.emplace(RamPayer::of(user_wallets, coopname), [&](auto& uw) {
          uw.id          = new_id;
          uw.wallet_name = MINSHR;
          uw.username    = p->username;
          uw.available   = amount;
          uw.blocked     = eosio::asset(0, amount.symbol);
        });
        moved     += amount;
        remaining -= amount;
      }

      if (moved.amount == 0) continue;

      // L2: w.sov.mnused → w.reg.minshr на перенесённую сумму.
      wallets.modify(mnused, RamPayer::of(wallets), [&](auto& w) { w.available -= moved; });
      if (mnused->is_empty()) wallets.erase(mnused);

      auto minshr = wallets.find(MINSHR.value);
      if (minshr == wallets.end()) {
        wallets.emplace(RamPayer::of(wallets), [&](auto& w) {
          w.id        = MINSHR;
          w.name      = std::string(ledger2_get_wallet_human_name(MINSHR));
          w.available = moved;
          w.blocked   = eosio::asset(0, moved.symbol);
        });
      } else {
        wallets.modify(minshr, RamPayer::of(wallets), [&](auto& w) { w.available += moved; });
      }
    }
  }
}
