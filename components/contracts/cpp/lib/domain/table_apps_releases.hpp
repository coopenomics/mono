#pragma once

#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "../core/utils.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Описание области видимости релиза.
 *
 * Возможные `kind`:
 *  - `"all"_n`     — релиз доступен всем кооперативам всех совместимых подсетей.
 *                    `targets` — пустой.
 *  - `"subnet"_n`  — релиз ограничен набором подсетей (по human-label
 *                    `subnet_label` из `coops`). `targets` — список labels.
 *  - `"canary"_n`  — релиз раскатывается на конкретные кооперативы.
 *                    `targets` — список `coopname`.
 *
 * Контракт scope-resolver не делает: он хранит scope как есть, а правило
 * приоритизации `canary > subnet > all` применяется на стороне `CA-auth`
 * при выпуске JWT.
 */
struct scope_t {
  name              kind;     // "all" | "subnet" | "canary"
  std::vector<name> targets;  // labels подсетей или coopname'ы

  EOSLIB_SERIALIZE(scope_t, (kind)(targets))
};

/**
 * \brief Запись каталога: один релиз пакета.
 *
 * Жизненный цикл записи:
 *
 *  1. `setrelease` создаёт row со `status=active`, `superseded_at=0`.
 *  2. Любой существующий active с тем же `(package_id, scope)` переходит
 *     в `superseded`, `superseded_at=now`.
 *  3. `withdraw` ставит `status=withdrawn` (релиз скомпрометирован /
 *     отозван юридически). `withdrawn` НЕ удаляются по TTL — храним до
 *     явной чистки.
 *  4. TTL retention: `superseded` старше 90 дней удаляются inline в
 *     `setrelease` (до 50 за вызов) или по явному `cleanup(package_id)`.
 *
 * Решение НЕ хранить полную историю принято намеренно: каталог — это
 * source-of-truth текущего состояния, история живёт в git/docker registry.
 * RAM-budget при 1000 пакетов × ~10 релизов в окне = ~40K записей.
 *
 * Indexing strategy:
 *  - PK `id` — auto-inc через `get_global_id(_apps, "release"_n)`.
 *  - `bypackage` — выборка всех релизов пакета (`CA` для scope-resolver).
 *  - `bypkgstat` — выборка active/superseded/withdrawn внутри пакета
 *    (composite `package_id<<8 | status_code`); удобно для cleanup
 *    «найти все superseded для пакета X».
 *  - `bysuperseded` — sorted by `superseded_at`; используется в cleanup
 *    для нахождения самых старых записей под удаление.
 *
 * \note `tarball_sha256` — содержательный хэш артефакта, нужен для
 *       integrity-check при скачивании. Сама проверка — на `CA-auth`,
 *       контракт хэш только хранит.
 *
 * \see lib/domain/table_apps_packages.hpp
 */
struct [[eosio::table, eosio::contract(APPS)]] release {
  uint64_t          id;
  name              package_id;       // FK → packages.package_id
  std::string       version;          // semver
  scope_t           scope;
  name              status;           // "active" | "superseded" | "withdrawn"
  time_point_sec    published_at;
  time_point_sec    superseded_at;    // 0 пока active
  name              moderated_by;     // имя модератора (audit)
  checksum256       tarball_sha256;
  std::string       meta;             // JSON-строка: changelog, релиз-нотес и т.п.

  uint64_t  primary_key()    const { return id; }
  uint64_t  by_package()     const { return package_id.value; }
  uint128_t by_pkg_status()  const { return ((uint128_t)package_id.value << 64) | status.value; }
  uint64_t  by_superseded()  const { return superseded_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "releases"_n, release,
    eosio::indexed_by<"bypackage"_n,    eosio::const_mem_fun<release, uint64_t,  &release::by_package>>,
    eosio::indexed_by<"bypkgstat"_n,    eosio::const_mem_fun<release, uint128_t, &release::by_pkg_status>>,
    eosio::indexed_by<"bysuperseded"_n, eosio::const_mem_fun<release, uint64_t,  &release::by_superseded>>>
    releases_index;

} // namespace Apps
