#include "apps.hpp"
#include <eosio/transaction.hpp>

#include "src/regpackage.cpp"
#include "src/transferpkg.cpp"
#include "src/setrelease.cpp"
#include "src/reactivate.cpp"
#include "src/withdraw.cpp"
#include "src/regsub.cpp"
#include "src/expsub.cpp"
#include "src/regcoop.cpp"
#include "src/setcoop.cpp"
#include "src/setpricing.cpp"
#include "src/setglobals.cpp"
#include "src/regclient.cpp"
#include "src/delclient.cpp"
#include "src/extendsub.cpp"
#include "src/setattempt.cpp"

/**
 * \brief Миграция контракта.
 * \details Пустышка для CDT-апгрейдов. Реальные миграции состояния
 *          выполняются через `eosio.msig`-предложение с конкретным
 *          планом (drop таблиц, переезд данных).
 * \note Авторизация: @ apps @ active.
 */
[[eosio::action]] void apps::migrate() {
  require_auth(_apps);
}

/**
 * @brief Очистка отработавших записей каталога приложений (lib/core/cleanup.hpp).
 *
 * Правило: вытесненный релиз старше срока хранения (`RELEASE_RETENTION_SECS`)
 * по всем пакетам — то же условие, что у `setrelease`. Отозванные
 * релизы остаются: по строке контракт не даёт опубликовать ту же версию заново.
 *
 * @note Авторизация требуется от аккаунта: @p apps
 */
void apps::cleanup() {
  require_auth(_apps);
  Cleanup::budget budget;

  const uint64_t now_sec = eosio::current_time_point().sec_since_epoch();
  const uint64_t threshold = now_sec > Apps::RELEASE_RETENTION_SECS ? now_sec - Apps::RELEASE_RETENTION_SECS : 0;

  releases_index releases(_apps, _apps.value);
  Cleanup::erase_where(releases, budget, [&](const auto &release) {
    return release.status == "superseded"_n && release.superseded_at.sec_since_epoch() < threshold;
  });

  Cleanup::report(_apps, budget);
}
