#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"
#include "../core/ram_payer.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Условия курса ЦПП «Образование» — всё, от чего зависит сумма.
 *
 * По этим условиям контракт сам считает взнос участника, оплаченный срок,
 * резерв преподавателям по подписке, взнос преподавателя за занятие и возврат
 * при отмене. Приложение сумм не считает и не передаёт: оно задаёт условия
 * действием `setcourse` и вызывает действия процесса.
 *
 * Плановая ставка — ставка за час занятия, заложенная во взнос каждого
 * участника. Она же предел ставки преподавателя на курсе (`eduassigns`).
 * Взнос участника от размера группы не зависит: занятий в месяц × оплата
 * занятия по плановой ставке + целевой членский взнос.
 *
 * Как считается взнос преподавателя за занятие, задаёт `per_learner`:
 *  - true — по ставке преподавателя за каждого участника с оплаченным
 *    доступом на дату занятия: больше участников — больше взнос;
 *  - false — фиксированный: ставка преподавателя за проведённое время, от
 *    числа участников не зависит. Оплата занятия остальных участников
 *    поступает на кошелёк программы.
 *
 * scope = coopname; primary_key = course_id — номер курса приложения, тот же,
 * что в `edu_subscription::course_id` и `edu_course::course_id`. Учёт средств
 * курса лежит отдельно, в `educourses`.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_terms {
  uint64_t course_id;                  ///< курс (off-chain id приложения)
  eosio::asset planned_rate;           ///< плановая ставка за час, заложенная во взнос участника — предел ставки преподавателя
  bool per_learner;                    ///< взнос преподавателя за занятие считается за каждого участника; false — фиксированный за занятие
  eosio::asset target_fee_month;       ///< целевой членский взнос за месяц
  uint32_t lessons_per_month;          ///< занятий в месяц по расписанию
  uint32_t lessons_total;              ///< занятий в программе курса; 0 — курс без конечной программы
  uint32_t lesson_minutes;             ///< длительность занятия, минут
  bool course_payment;                 ///< взнос разом за весь курс разрешён
  uint32_t discount_bp;                ///< скидка за взнос разом, сотые доли процента
  uint32_t guarantee_days;             ///< гарантийный срок, дней; 0 — гарантия не объявлена
  eosio::time_point_sec starts_at;     ///< начало занятий; нулевое время — курс не активирован
  uint32_t subs_active;                ///< действующих подписок — при них денежные условия не меняются
  uint32_t lessons_opened;             ///< номер последнего открытого занятия
  uint64_t open_lesson_id;             ///< занятие, по которому идёт расчёт; 0 — открытого занятия нет
  eosio::time_point_sec last_held_at;  ///< дата последнего закрытого занятия

  uint64_t primary_key() const { return course_id; }

  bool is_started() const { return starts_at.sec_since_epoch() > 0; }

  /// Оплата одного занятия за одного участника по плановой ставке.
  eosio::asset lesson_unit() const {
    return eosio::asset(planned_rate.amount * static_cast<int64_t>(lesson_minutes) / 60, planned_rate.symbol);
  }

  /// Членский взнос за месяц: оплата занятий месяца по плановой ставке и целевой членский взнос.
  eosio::asset fee_month() const {
    return lesson_unit() * static_cast<int64_t>(lessons_per_month) + target_fee_month;
  }

  /// Длительность курса в месяцах; неполный последний месяц считается месяцем. 0 — программа без конца.
  uint32_t months_total() const {
    if (lessons_per_month == 0 || lessons_total == 0) return 0;
    return (lessons_total + lessons_per_month - 1) / lessons_per_month;
  }
};

typedef eosio::multi_index<"eduterms"_n, edu_terms> edu_terms_index;

/**
 * @brief Допуск преподавателя к курсу и его ставка на этом курсе.
 *
 * Ставка — за час занятия, не выше плановой ставки курса; за каждого участника
 * либо за всё занятие — по способу расчёта курса.
 * Администратор меняет её по ходу курса (`setassign`); новая ставка действует
 * на занятия, открытые после правки: ставка занятия фиксируется в `edulessons`.
 *
 * scope = coopname; primary_key = assignment_id — номер допуска приложения.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_assignment {
  uint64_t assignment_id;  ///< допуск (off-chain id приложения)
  eosio::name username;    ///< пайщик-преподаватель
  uint64_t course_id;      ///< курс
  eosio::asset rate;       ///< ставка преподавателя за час на одного участника

  uint64_t primary_key() const { return assignment_id; }
  uint64_t by_course()   const { return course_id; }
};

typedef eosio::multi_index<
    "eduassigns"_n, edu_assignment,
    eosio::indexed_by<"bycourse"_n, eosio::const_mem_fun<edu_assignment, uint64_t, &edu_assignment::by_course>>>
    edu_assignments_index;

/**
 * @brief Занятие, по которому идёт расчёт с участниками.
 *
 * Запись живёт от отчёта преподавателя (`openlesson`) до приёма материалов на
 * ответственное хранение (`holdrid`). Между ними приложение по одной подписке
 * вызывает `chargelesson`: контракт переносит оплату занятия из резерва
 * подписки в сумму занятия и считает участников. Число участников и сумма —
 * срез курса на дату занятия.
 *
 * scope = coopname; ключ процесса — `rid_hash`, тот же, что у материалов.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_lesson {
  uint64_t id;                     ///< внутренний ID
  checksum256 rid_hash;            ///< process_hash для p.edu.rid
  uint64_t course_id;              ///< курс
  uint64_t assignment_id;          ///< допуск преподавателя
  eosio::name username;            ///< пайщик-преподаватель
  uint32_t number;                 ///< номер занятия в курсе
  eosio::time_point_sec held_at;   ///< дата проведения
  uint32_t minutes;                ///< длительность, минут
  eosio::asset rate;               ///< ставка преподавателя на момент отчёта
  eosio::asset charge;             ///< ставка преподавателя за проведённое время: взнос за одного участника либо фиксированный взнос за занятие
  eosio::asset unit;               ///< оплата этого занятия по плановой ставке за проведённое время — столько уходит из резерва каждой подписки
  uint32_t learners;               ///< участников с оплаченным доступом, по которым прошёл расчёт
  eosio::asset amount;             ///< взнос преподавателя за занятие
  eosio::time_point_sec created_at;

  uint64_t primary_key() const { return id; }
  checksum256 by_hash()  const { return rid_hash; }
};

typedef eosio::multi_index<
    "edulessons"_n, edu_lesson,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<edu_lesson, checksum256, &edu_lesson::by_hash>>>
    edu_lessons_index;

} // namespace Edubridge

// Плательщик за оперативную память строк таблиц — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Edubridge::edu_terms, cooperative);
RAM_PAYER_CLASS(Edubridge::edu_assignment, cooperative);
RAM_PAYER_CLASS(Edubridge::edu_lesson, cooperative);
