#include <vector>

/**
 * @brief Универсальное миграционное действие контракта ledger2 — точка
 * расширения для разовых исправлений состояния, которые можно провести
 * автоматически после деплоя.
 *
 * Содержимое периодически переписывается под текущую задачу миграции, а
 * после её прогона на проде тело очищается до пустого `require_auth(get_self())`
 * (как в `capital::migrate`).
 *
 * Текущая задача (2026-05-21): чистка осиротевших L3-записей `w.cap.gen`
 * на voskhod после смены WalletKind GENERATOR_FUND с USER_SHARED на
 * COOPERATIVE (см. `lib/core/ledger2/wallets.hpp`).
 *
 * Контекст: на voskhod `convertsegm` падал «недостаточно L3-средств у
 * пайщика» в проектах, где CRPS перераспределял доли между сегментами.
 * w.cap.gen был USER_SHARED, а CRPS в approvecmmt не делал per-user
 * компенсирующих TRANSFER между сегментами: `Σ COMMIT_RID == Σ ACCEPT_RID`
 * соблюдался только на проекте, не на пайщике.
 *
 * Архитектурный фикс: w.cap.gen — COOPERATIVE-пул без L3. Чтобы UI/бэкенд
 * не врали остатками по «личным» w.cap.gen, удаляем осиротевшие L3-записи
 * прямым `userwallets.erase`. L2-баланс `wallets2[w.cap.gen]` уже верен
 * (синхронен с Σ старых userwallets), его не трогаем.
 *
 * Идемпотентно: повторный вызов на чистой БД — no-op (lower_bound пуст).
 * Только voskhod: на остальных кооперативах w.cap.gen не использовался.
 *
 * @ingroup public_ledger2_actions
 *
 * @note Авторизация требуется от аккаунта: @p ledger2 (get_self()).
 */
void ledger2::migrate() {
  require_auth(get_self());

  const eosio::name target_coop = "voskhod"_n;

  userwallets_index user_wallets(get_self(), target_coop.value);
  auto idx = user_wallets.get_index<"bywallet"_n>();

  // Собираем primary id записей до erase (модификация контейнера при
  // итерации через secondary index — небезопасна).
  std::vector<uint64_t> ids_to_erase;
  for (auto it = idx.lower_bound(ledger2_wallets::GENERATOR_FUND.value);
       it != idx.end() && it->wallet_name == ledger2_wallets::GENERATOR_FUND;
       ++it) {
    ids_to_erase.push_back(it->id);
  }

  for (uint64_t id : ids_to_erase) {
    auto pri = user_wallets.find(id);
    if (pri != user_wallets.end()) {
      user_wallets.erase(pri);
    }
  }
}
