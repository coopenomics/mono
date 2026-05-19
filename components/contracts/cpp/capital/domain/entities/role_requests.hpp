#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;
using std::string;

namespace Capital::RoleRequests {

/**
 * @brief Статусы заявки на роль / обновление approved-ставки.
 */
namespace Status {
  constexpr name PENDING  = "pending"_n;
  constexpr name APPROVED = "approved"_n;
  constexpr name DECLINED = "declined"_n;
}

/**
 * @brief Направление: пайщик просит сам (REQUEST) или мастер инвайтит кандидата (INVITE).
 */
namespace Direction {
  constexpr name REQUEST = "request"_n;
  constexpr name INVITE  = "invite"_n;
}

/**
 * @brief Тип заявки: «дай мне роль/допуск L2» или «обнови мне approved-ставку».
 */
namespace RequestType {
  constexpr name ROLE        = "role"_n;
  constexpr name RATE_UPDATE = "rateupdate"_n;
}

/**
 * @brief Допустимые роли заявки на L2-допуск.
 * Контрибьюторы и инвесторы — L1, через role_requests не идут.
 */
namespace Role {
  constexpr name CREATOR = "creator"_n;
  constexpr name AUTHOR  = "author"_n;
  constexpr name MASTER  = "master"_n;
  constexpr name NONE    = name{};   ///< Для RATE_UPDATE: поле role не значимо
}

/**
 * @brief Очередь заявок на L2-допуск/инвайт и на обновление approved-ставки.
 *
 * Бездокументарная схема: подача и решение оформляются только транзакцией
 * блокчейна (require_auth coopname). Юридическое заявление при приёме на роль
 * не требуется — допуск даётся через подпись действия на стороне кооператива.
 *
 * @par Область памяти (scope): coopname
 * @par Имя таблицы (table): rolerequests
 */
struct [[eosio::table, eosio::contract(CAPITAL)]] role_request {
  uint64_t      id;                                                  ///< Внутренний ключ
  eosio::name   coopname;                                            ///< Кооператив
  checksum256   request_hash;                                        ///< Хеш заявки (анкер)
  checksum256   project_hash;                                        ///< Проект / компонент
  eosio::name   username;                                            ///< Заявитель (REQUEST) или кандидат (INVITE)
  eosio::name   master;                                              ///< Мастер компонента (одобряющий) — при invite на роль master это координатор/председатель
  eosio::name   role             = Role::NONE;                       ///< Role::CREATOR | Role::AUTHOR | Role::MASTER (для RequestType::RATE_UPDATE — Role::NONE)
  eosio::asset  rate_per_hour    = asset(0, _root_govern_symbol);    ///< Заявленная пайщиком/мастером ставка часа (всегда явная, не из contributors)
  uint64_t      hours_per_day    = 0;                                ///< Заявленная норма часов
  eosio::asset  approved_rate    = asset(0, _root_govern_symbol);    ///< Утверждённая ставка (≠ requested при approve)
  uint64_t      approved_hours   = 0;                                ///< Утверждённая норма часов
  eosio::name   direction        = Direction::REQUEST;               ///< request | invite
  eosio::name   request_type     = RequestType::ROLE;                ///< role | rateupdate
  eosio::name   status           = Status::PENDING;                  ///< pending | approved | declined
  std::string   description;                                         ///< Текст заявки / приглашения (может быть пустым)
  std::string   decline_reason;                                      ///< Причина отказа (если DECLINED)
  time_point_sec created_at      = current_time_point();

  uint64_t   primary_key() const   { return id; }
  checksum256 by_request_hash() const { return request_hash; }
  uint128_t  by_project_user() const {
    return combine_checksum_ids(project_hash, username);
  }
};

typedef eosio::multi_index<
  "rolerequests"_n, role_request,
  indexed_by<"byhash"_n,     const_mem_fun<role_request, checksum256, &role_request::by_request_hash>>,
  indexed_by<"byprojuser"_n, const_mem_fun<role_request, uint128_t,   &role_request::by_project_user>>
> role_requests_index;

inline std::optional<role_request> get_role_request(eosio::name coopname, const checksum256 &request_hash) {
  role_requests_index t(_capital, coopname.value);
  auto idx = t.get_index<"byhash"_n>();
  auto itr = idx.find(request_hash);
  if (itr == idx.end()) return std::nullopt;
  return role_request(*itr);
}

inline role_request get_role_request_or_fail(eosio::name coopname, const checksum256 &request_hash) {
  auto v = get_role_request(coopname, request_hash);
  eosio::check(v.has_value(), "Заявка на роль не найдена");
  return v.value();
}

inline void create(
  eosio::name coopname,
  const checksum256 &request_hash,
  const checksum256 &project_hash,
  eosio::name username,
  eosio::name master,
  eosio::name role,
  const eosio::asset &rate_per_hour,
  uint64_t hours_per_day,
  eosio::name direction,
  eosio::name request_type,
  const std::string &description
) {
  role_requests_index t(_capital, coopname.value);
  eosio::check(!get_role_request(coopname, request_hash).has_value(),
               "Заявка с указанным хэшем уже существует");

  uint64_t id = get_global_id_in_scope(_capital, coopname, "rolerequests"_n);
  t.emplace(coopname, [&](auto &r) {
    r.id = id;
    r.coopname = coopname;
    r.request_hash = request_hash;
    r.project_hash = project_hash;
    r.username = username;
    r.master = master;
    r.role = role;
    r.rate_per_hour = rate_per_hour;
    r.hours_per_day = hours_per_day;
    r.direction = direction;
    r.request_type = request_type;
    r.status = Status::PENDING;
    r.description = description;
    r.created_at = current_time_point();
  });
}

/**
 * @brief Проверяет, что role входит в допустимый набор Role::{CREATOR, AUTHOR, MASTER}.
 *        Контрибьюторы и инвесторы — это L1-роли и через role_requests не идут.
 *        Не применяется к заявкам RequestType::RATE_UPDATE (там role = Role::NONE).
 */
inline void validate_role_or_fail(eosio::name role) {
  eosio::check(
    role == Role::CREATOR || role == Role::AUTHOR || role == Role::MASTER,
    "Допустимые роли заявки: creator, author, master"
  );
}

/**
 * @brief Применяет заявленную роль к проекту через inline action:
 *        Role::AUTHOR → addauthor, Role::MASTER → setmaster, Role::CREATOR → no-op
 *        (creator фиксируется фактически при первом createcmmt).
 *
 * Вызывается из approverole/acceptinvite после фиксации решения, чтобы
 * заявленная при подаче роль немедленно отражалась в реестре участников.
 * Inline action идёт под permission coopname — председатель/backend подписывает.
 */
inline void apply_role_to_project(
  eosio::name coopname,
  const checksum256 &project_hash,
  eosio::name username,
  eosio::name role
) {
  if (role == Role::AUTHOR) {
    eosio::action(
      eosio::permission_level{coopname, "active"_n},
      _capital,
      "addauthor"_n,
      std::make_tuple(coopname, project_hash, username)
    ).send();
  } else if (role == Role::MASTER) {
    eosio::action(
      eosio::permission_level{coopname, "active"_n},
      _capital,
      "setmaster"_n,
      std::make_tuple(coopname, project_hash, username)
    ).send();
  }
}

inline void approve(
  eosio::name coopname,
  uint64_t request_id,
  const eosio::asset &approved_rate,
  uint64_t approved_hours
) {
  role_requests_index t(_capital, coopname.value);
  auto itr = t.find(request_id);
  eosio::check(itr != t.end(), "Заявка не найдена");
  eosio::check(itr->status == Status::PENDING, "Заявка уже обработана");
  t.modify(itr, coopname, [&](auto &r) {
    r.status = Status::APPROVED;
    r.approved_rate = approved_rate;
    r.approved_hours = approved_hours;
  });
}

inline void decline(eosio::name coopname, uint64_t request_id, const std::string &reason) {
  role_requests_index t(_capital, coopname.value);
  auto itr = t.find(request_id);
  eosio::check(itr != t.end(), "Заявка не найдена");
  eosio::check(itr->status == Status::PENDING, "Заявка уже обработана");
  t.modify(itr, coopname, [&](auto &r) {
    r.status = Status::DECLINED;
    r.decline_reason = reason;
  });
}

} // namespace Capital::RoleRequests
