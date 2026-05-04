#pragma once

#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Запись каталога: один зарегистрированный пакет.
 *
 * Идентификация: PK = `package_id` (Antelope `name`, ≤12 символов, [a-z1-5.]).
 * Имя выбирает разработчик при публикации; уникальность гарантируется блокчейном
 * (`emplace` фейлится, если такой `package_id` уже зарегистрирован).
 *
 * Имена пакета:
 *  - `package_id` — кодовое неизменяемое имя в каталоге (этот PK).
 *  - `package_name` — внешнее человекочитаемое имя (например, npm
 *    `@voskhod/sports-club-tracker`, go-module path или OCI-image name).
 *    Меняется через `setpkgname` (если потребуется) или re-publish; в текущей
 *    схеме допускается изменение через rename-action в будущем.
 *
 * `compatible_subnets` — human-labels подсетей (`ru`, `by`, ...). Реальная
 * идентификация подсети — через `chain_id`, который хранится в `coops`/`subs`;
 * здесь labels достаточно, потому что они используются только для display
 * и грубой фильтрации в UI.
 *
 * `last_active_version` — semver самого свежего active-релиза c `scope.kind=all`.
 * Поле обновляется только при `setrelease` со scope=all и используется для
 * быстрого ответа `GET /v1/package/:id` без сканирования таблицы `releases`.
 * Canary-релизы это поле не трогают — оно отражает «версию по умолчанию»
 * для кооперативов вне canary-целей.
 *
 * \see lib/domain/table_apps_releases.hpp — связанные релизы (FK by_package).
 */
struct [[eosio::table, eosio::contract(APPS)]] package {
  name              package_id;            // PK, кодовое имя
  std::string       package_name;          // внешнее имя (npm/go/oci)
  name              owner;                 // владелец (username разработчика)
  std::vector<name> compatible_subnets;    // labels подсетей: "ru","by",...
  std::string       last_active_version;   // semver последнего scope=all active
  time_point_sec    created_at;
  time_point_sec    updated_at;

  uint64_t primary_key() const { return package_id.value; }
  uint64_t by_owner()    const { return owner.value; }
  uint64_t by_subnet()   const {
    return compatible_subnets.empty() ? 0 : compatible_subnets[0].value;
  }
};

typedef eosio::multi_index<
    "packages"_n, package,
    eosio::indexed_by<"byowner"_n,  eosio::const_mem_fun<package, uint64_t, &package::by_owner>>,
    eosio::indexed_by<"bysubnet"_n, eosio::const_mem_fun<package, uint64_t, &package::by_subnet>>>
    packages_index;

} // namespace Apps
