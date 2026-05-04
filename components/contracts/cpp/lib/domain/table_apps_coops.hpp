#pragma once

#include <eosio/eosio.hpp>
#include <eosio/crypto.hpp>

#include "../consts.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Запись каталога: кооператив, зарегистрированный в каталоге.
 *
 * Регистрация кооператива в каталоге — это часть процесса подключения
 * к каталогу приложений на Восходе (вне scope текущего MVP). Шаги:
 *
 *  1. Кооператив проходит onboarding в кабинете ВОСХОД.
 *  2. Кабинет генерирует/принимает выделенный subnet-signing-keypair.
 *     Приватная часть остаётся у DC-оркестратора кооператива.
 *  3. Кабинет вызывает `regcoop(coopname, chain_id, subnet_label, signing_key)`
 *     с публичной частью.
 *
 * Поле `signing_key` — это **отдельный** ключ, не равный `eosio::active`-ключу
 * аккаунта. Семантика:
 *
 *  - Используется только off-chain в `CA-auth` для проверки подписи
 *    `signed-request`-ов от DC-оркестратора (заголовок `X-Signature`).
 *  - НЕ имеет on-chain прав (`active` остаётся отдельно).
 *  - Ротация — отдельным action `setcoop(signing_key=new)`. Компрометация
 *    `active` не лопает signed-request-цепочку и наоборот.
 *  - Ранее выпущенные JWT (TTL 14 дней) остаются валидны после ротации;
 *    только новые signed-request'ы должны идти от нового приват-ключа.
 *
 * `chain_id` (`checksum256`) — каноническая идентификация подсети, в которой
 * зарегистрирован кооператив (как в memory `subnet_identification` в
 * apps-catalog). `subnet_label` (`ru`/`by`/...) — human-label, удобный
 * для UI, scope-фильтрации в `releases`, и логирования.
 *
 * Контракт сам подпись не проверяет — он только хранит публичный ключ.
 * Проверка ECDSA secp256k1 — на стороне `CA-auth` через RPC
 * `get_table_rows apps coops`.
 */
struct [[eosio::table, eosio::contract(APPS)]] coop {
  name              coopname;       // PK = Antelope name
  checksum256       chain_id;       // подсеть (каноническая идентификация)
  name              subnet_label;   // human-label "ru"/"by" для UI/scope
  public_key        signing_key;    // subnet-signing-key (НЕ active)
  bool              active;
  time_point_sec    registered_at;
  time_point_sec    key_rotated_at; // последняя ротация signing_key

  uint64_t primary_key() const { return coopname.value; }
  uint64_t by_subnet()   const { return subnet_label.value; }
};

typedef eosio::multi_index<
    "coops"_n, coop,
    eosio::indexed_by<"bysubnet"_n, eosio::const_mem_fun<coop, uint64_t, &coop::by_subnet>>>
    coops_index;

} // namespace Apps
