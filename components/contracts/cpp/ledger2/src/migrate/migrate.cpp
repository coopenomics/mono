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
}
