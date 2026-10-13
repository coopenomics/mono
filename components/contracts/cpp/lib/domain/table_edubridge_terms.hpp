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
/// Окно расписания в условиях группы: длительность и плановая стоимость занятия для одного участника.
struct edu_slot_terms {
  uint32_t minutes;    ///< длительность занятия окна, минут
  eosio::asset cost;   ///< стоимость занятия окна для участника — заложена во взнос, потолок взноса преподавателя

  friend bool operator==(const edu_slot_terms& a, const edu_slot_terms& b) { return a.minutes == b.minutes && a.cost == b.cost; }

  EOSLIB_SERIALIZE(edu_slot_terms, (minutes)(cost))
};

struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_terms {
  uint64_t course_id;                  ///< курс (off-chain id приложения)
  std::vector<edu_slot_terms> slots;   ///< окна расписания: по индексу окна отчёт о занятии находит его стоимость
  bool per_learner;                    ///< взнос преподавателя за занятие считается за каждого участника; false — фиксированный за занятие
  eosio::asset target_fee_month;       ///< целевой членский взнос за месяц
  uint32_t minutes_per_month;          ///< минут занятий в месяц по расписанию: минуты недели на четыре недели месяца
  uint32_t minutes_total;              ///< минут занятий в программе курса; 0 — курс без конечной программы
  bool course_payment;                 ///< взнос разом за весь курс разрешён
  uint32_t discount_bp;                ///< скидка за взнос разом, сотые доли процента
  uint32_t guarantee_secs;             ///< гарантийный срок, секунд (приложение передаёт дни × длину суток); 0 — гарантия не объявлена
  eosio::time_point_sec starts_at;     ///< начало занятий; нулевое время — курс не активирован
  uint32_t subs_active;                ///< действующих подписок — при них денежные условия не меняются
  uint32_t minutes_opened;             ///< минут занятий отчитано по группе
  uint32_t charging;                   ///< занятий в окне расчёта с участниками: отчёт подан, расчёт по подпискам не закрыт
  std::vector<uint32_t> numbers;       ///< номера отчитанных занятий группы: номер занимается один раз; отзыв отчёта освобождает его
  uint32_t subs_locked = 0;            ///< подписок с незакрытым гарантийным сроком: пока они есть, суммы преподавателей за гарантийный период не окончательны
  eosio::binary_extension<uint32_t> month_secs; ///< длина месяца, секунд: оплаченный период и длительность программы считаются ею; 0 либо нет значения — месяц в четыре недели (28 дней). Не ноль только на стенде разработки со сжатым временем

  /// Длина месяца в секундах; 0 — четыре недели.
  uint32_t month_len() const { return month_secs.has_value() ? month_secs.value() : 0; }

  uint64_t primary_key() const { return course_id; }

  bool is_started() const { return starts_at.sec_since_epoch() > 0; }

  /// Номер занятия уже занят отчитанным занятием группы.
  bool has_number(uint32_t number) const {
    for (const auto n : numbers) if (n == number) return true;
    return false;
  }

  /// Освободить номер занятия после отзыва отчёта.
  void drop_number(uint32_t number) {
    for (auto it = numbers.begin(); it != numbers.end(); ++it) {
      if (*it == number) { numbers.erase(it); return; }
    }
  }

  /// Недель в месяце для перевода недельного расписания в месячное: месяц считается как четыре недели, как на калькуляторе.
  static constexpr int64_t WEEKS_PER_MONTH = 4;

  /// Оплата занятий месяца одним участником: стоимости окон недели на четыре недели месяца.
  eosio::asset teach_month() const {
    __int128 week = 0;
    for (const auto& s : slots) week += s.cost.amount;
    return eosio::asset(static_cast<int64_t>(week * WEEKS_PER_MONTH), target_fee_month.symbol);
  }

  /// Оплата части месяца пропорционально минутам: взнос по остатку программы и резерв подписки.
  eosio::asset teach_for_minutes(uint32_t minutes) const {
    if (minutes_per_month == 0) return eosio::asset(0, target_fee_month.symbol);
    return eosio::asset(static_cast<int64_t>(static_cast<__int128>(teach_month().amount) * minutes / minutes_per_month), target_fee_month.symbol);
  }

  /// Стоимость занятия по окну для одного участника; занятие другой длины — пропорционально минутам окна.
  eosio::asset slot_cost(uint32_t slot, uint32_t minutes) const {
    eosio::check(slot < slots.size(), "EDUBRIDGE_SLOT_NOT_FOUND: Окна расписания с таким номером у группы нет");
    const auto& s = slots[slot];
    if (s.minutes == 0 || minutes == s.minutes) return s.cost;
    return eosio::asset(static_cast<int64_t>(static_cast<__int128>(s.cost.amount) * minutes / s.minutes), s.cost.symbol);
  }

  /// Членский взнос за месяц: оплата занятий месяца и целевой членский взнос.
  eosio::asset fee_month() const {
    return teach_month() + target_fee_month;
  }

  /// Длительность курса в месяцах; неполный последний месяц считается месяцем. 0 — программа без конца.
  uint32_t months_total() const {
    if (minutes_per_month == 0 || minutes_total == 0) return 0;
    return (minutes_total + minutes_per_month - 1) / minutes_per_month;
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
  eosio::asset deferred;   ///< взнос преподавателя за занятия гарантийного срока: складывается по подпискам, закрывшим срок
  uint32_t deferred_lessons = 0; ///< занятий гарантийного срока, по которым материалы ещё не приняты на хранение

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
  uint32_t minutes;                ///< длительность, минут — из календаря группы
  eosio::asset cost;               ///< стоимость занятия для одного участника — по окну расписания; столько списывается из резерва подписки
  eosio::asset rate;               ///< ставка преподавателя на момент отчёта
  eosio::asset charge;             ///< ставка преподавателя за проведённое время, не больше стоимости занятия: взнос за одного участника либо фиксированный взнос за занятие
  uint32_t learners;               ///< участников с оплаченным доступом, по которым прошёл расчёт
  eosio::asset amount;             ///< взнос преподавателя за занятие
  eosio::time_point_sec created_at;
  bool deferred = false;           ///< занятие гарантийного срока: документов с суммой нет до конца срока, сумма — в допуске преподавателя
  bool settled = false;            ///< окно расчёта закрыто: подписки рассчитаны, новых расчётов по занятию нет

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
