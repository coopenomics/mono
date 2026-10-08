#pragma once

#include <algorithm>
#include <string>

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "edubridge.hpp"

/**
 * @file economy.hpp
 * @brief Денежная математика ЦПП «Образование».
 *
 * Все суммы процесса считает контракт: взнос участника и оплаченный срок,
 * удержание по гарантии, резерв преподавателям по подписке, взнос
 * преподавателя за занятие, возврат при отмене. Приложение сумм не передаёт —
 * оно вызывает действие, а расчёт идёт здесь по условиям курса (`eduterms`).
 *
 * Одно действие считает одну подписку. Перебора таблиц нет: порядок обхода
 * подписок ведёт приложение, полноту обеспечивает учёт в самой подписке
 * (остаток резерва и номер последнего рассчитанного занятия).
 */
namespace Edubridge {

using namespace eosio;

inline constexpr uint32_t SECONDS_IN_DAY = 24 * 60 * 60;
inline constexpr uint32_t BP_IN_WHOLE = 10000;

// ── Календарь ────────────────────────────────────────────────────────────

/// Дней от 1970-01-01 до даты гражданского календаря.
inline int64_t days_from_civil(int64_t y, uint32_t m, uint32_t d) {
  y -= m <= 2;
  const int64_t era = (y >= 0 ? y : y - 399) / 400;
  const uint32_t yoe = static_cast<uint32_t>(y - era * 400);
  const uint32_t doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const uint32_t doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int64_t>(doe) - 719468;
}

inline uint32_t days_in_month(int64_t y, uint32_t m) {
  static const uint32_t days[] = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
  const bool leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
  return m == 2 && leap ? 29 : days[m - 1];
}

/**
 * @brief Дата плюс календарные месяцы; время суток сохраняется.
 *
 * Числа, которого в месяце нет, не бывает: 31 января плюс месяц — последний
 * день февраля.
 */
inline eosio::time_point_sec add_months(eosio::time_point_sec from, uint32_t months) {
  const uint32_t sec = from.sec_since_epoch();
  const int64_t z = static_cast<int64_t>(sec / SECONDS_IN_DAY) + 719468;
  const int64_t era = z / 146097;
  const uint32_t doe = static_cast<uint32_t>(z - era * 146097);
  const uint32_t yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  int64_t y = static_cast<int64_t>(yoe) + era * 400;
  const uint32_t doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const uint32_t mp = (5 * doy + 2) / 153;
  uint32_t d = doy - (153 * mp + 2) / 5 + 1;
  uint32_t m = mp < 10 ? mp + 3 : mp - 9;
  y += m <= 2;

  const uint32_t total = (m - 1) + months;
  y += total / 12;
  m = total % 12 + 1;
  const uint32_t last = days_in_month(y, m);
  if (d > last) d = last;

  return eosio::time_point_sec(static_cast<uint32_t>(days_from_civil(y, m, d)) * SECONDS_IN_DAY + sec % SECONDS_IN_DAY);
}

// ── Условия курса ────────────────────────────────────────────────────────

/// Условия курса; бросает, если администратор их ещё не задал.
inline edu_terms get_terms_or_fail(eosio::name coopname, uint64_t course_id) {
  edu_terms_index terms(_edubridge, coopname.value);
  auto it = terms.find(course_id);
  eosio::check(it != terms.end(), "Условия курса не заданы");
  return *it;
}

template <typename Fn>
inline void update_terms(eosio::name coopname, uint64_t course_id, Fn&& change) {
  edu_terms_index terms(_edubridge, coopname.value);
  auto it = terms.find(course_id);
  eosio::check(it != terms.end(), "Условия курса не заданы");
  terms.modify(it, RamPayer::of(terms, coopname), [&](auto& t) { change(t); });
}

// ── Гарантийный срок ─────────────────────────────────────────────────────

/**
 * @brief Идёт ли гарантийный срок участника по подписке.
 *
 * Срок отсчитывается от более поздней из двух дат — начала занятий и дня
 * открытия подписки. У неактивированного курса с объявленной гарантией срок
 * ещё впереди. Продление срок заново не запускает.
 */
inline bool is_guarantee_running(const edu_terms& terms, const edu_subscription& sub, eosio::time_point_sec now) {
  if (terms.guarantee_days == 0) return false;
  if (!terms.is_started()) return true;
  const uint32_t from = std::max(terms.starts_at.sec_since_epoch(), sub.created_at.sec_since_epoch());
  return now.sec_since_epoch() < from + terms.guarantee_days * SECONDS_IN_DAY;
}

/// До какой даты материалы занятия лежат на ответственном хранении — гарантийный срок курса от начала занятий.
inline eosio::time_point_sec lesson_hold_until(const edu_terms& terms, eosio::time_point_sec held_at) {
  if (terms.guarantee_days == 0 || !terms.is_started()) return held_at;
  return eosio::time_point_sec(terms.starts_at.sec_since_epoch() + terms.guarantee_days * SECONDS_IN_DAY);
}

// ── Взнос участника ──────────────────────────────────────────────────────

/// Что оплачивает один взнос — считает контракт по условиям курса.
struct FeeQuote {
  uint32_t months = 0;               ///< месяцев оплачивает взнос
  uint32_t lessons = 0;              ///< занятий оплачивает взнос
  eosio::asset amount;               ///< взнос к уплате
  eosio::asset teach;                ///< из него оплата занятий по плановой ставке — резерв подписки
  eosio::time_point_sec paid_from;   ///< с какого дня идёт новый оплаченный срок
  eosio::time_point_sec paid_until;  ///< до какого дня оплачено
};

/**
 * @brief Расчёт взноса участника.
 *
 * Помесячный взнос оплачивает месяц от конца уже оплаченного срока либо от
 * сегодняшнего дня. Взнос разом оплачивает месяцы до конца программы со
 * скидкой курса: пришедший в середине вносит за остаток.
 */
inline FeeQuote quote_fee(const edu_terms& terms, const edu_subscription& sub, eosio::name period, eosio::time_point_sec now) {
  eosio::check(terms.lessons_per_month > 0 && terms.lesson_minutes > 0 && terms.planned_rate.amount > 0,
               "Условия курса не заданы");
  const bool paid = sub.has_plan() && sub.plan.value().lessons_paid > 0;
  const eosio::time_point_sec from = paid && sub.paid_until > now ? sub.paid_until : now;

  FeeQuote q;
  uint32_t discount_bp = 0;
  if (period == SubscriptionPeriod::MONTH) {
    q.months = 1;
    q.paid_from = from;
    q.paid_until = add_months(from, 1);
  } else {
    eosio::check(period == SubscriptionPeriod::COURSE, "Недопустимый период оплаты: ожидается month либо course");
    const uint32_t total = terms.months_total();
    eosio::check(terms.course_payment && total > 0, "Взнос за весь курс по этому курсу не принимается");
    const eosio::time_point_sec start = terms.is_started() ? terms.starts_at : from;
    const eosio::time_point_sec end = add_months(start, total);
    const eosio::time_point_sec base = from > start ? from : start;
    eosio::check(base < end, "Курс оплачен до конца программы");
    uint32_t months = 1;
    while (months < total && add_months(base, months) < end) months += 1;
    q.months = months;
    q.paid_from = base;
    q.paid_until = end;
    discount_bp = terms.discount_bp;
  }

  // Занятий не больше, чем осталось в программе курса.
  uint32_t lessons = terms.lessons_per_month * q.months;
  if (terms.lessons_total > 0) {
    const uint32_t already = sub.has_plan() ? sub.plan.value().lessons_paid : 0;
    const uint32_t left = terms.lessons_total > already ? terms.lessons_total - already : 0;
    eosio::check(left > 0, "Курс оплачен до конца программы");
    if (lessons > left) lessons = left;
  }
  q.lessons = lessons;

  const eosio::asset base_amount = terms.fee_month() * static_cast<int64_t>(q.months);
  const eosio::asset discount(base_amount.amount * discount_bp / BP_IN_WHOLE, base_amount.symbol);
  q.amount = base_amount - discount;
  q.teach = terms.lesson_unit() * static_cast<int64_t>(lessons);
  eosio::check(q.teach <= q.amount, "Скидка курса больше целевого членского взноса");
  return q;
}

// ── Возврат ──────────────────────────────────────────────────────────────

/**
 * @brief Возврат участнику при отказе после начала занятий.
 *
 * Половина остаточной стоимости подписки (Положение ЦПП «Образование»).
 * Остаточная стоимость — доля всего внесённого взноса, вместе с целевым
 * членским взносом, приходящаяся на занятия, по которым расчёт ещё не прошёл.
 * Проведённые занятия считает контракт по каждой подписке (`chargelesson`),
 * поэтому сумма возврата в любой момент точная.
 */
inline eosio::asset refusal_refund(const edu_subscription& sub) {
  const auto& plan = sub.plan.value();
  const eosio::asset charged = sub.charged_or_zero();
  if (plan.lessons_paid == 0 || plan.lessons_done >= plan.lessons_paid) return eosio::asset(0, charged.symbol);
  const int64_t residual = static_cast<int64_t>(
      static_cast<__int128>(charged.amount) * (plan.lessons_paid - plan.lessons_done) / plan.lessons_paid);
  return eosio::asset(residual / 2, charged.symbol);
}

/**
 * @brief Сколько по подписке удерживается после гарантийного срока.
 *
 * Участник вправе отказаться и получить возврат, поэтому сумма возможного
 * возврата на расходы программы не идёт. Её обеспечивают резерв за
 * непроведённые занятия (при отказе он высвобождается) и удержание: держится
 * только то, чего в резерве не хватает. С каждым проведённым занятием возврат
 * уменьшается, и удержание освобождается.
 */
inline eosio::asset required_lock(const edu_subscription& sub) {
  const eosio::asset refund = refusal_refund(sub);
  const eosio::asset reserve = sub.plan.value().reserve;
  return refund > reserve ? refund - reserve : eosio::asset(0, refund.symbol);
}

// ── Движения средств по подписке ─────────────────────────────────────────

/// Проверка учёта курса: резерв и выплаты преподавателям не превышают собранного по курсу.
inline void check_course_covered(const edu_course& c) {
  eosio::check(c.reserve + c.settled <= c.collected,
               std::string{"Средств курса недостаточно: собрано "} + c.collected.to_string() +
                 ", в резерве преподавателям " + c.reserve.to_string() + ", выплачено " + c.settled.to_string());
}

/**
 * @brief Удержание по подписке приводится к сумме возможного возврата.
 *
 * Для подписки с закрытым гарантийным сроком. Удержано больше нужного —
 * лишнее возвращается на кошелёк программы (`o.edu.unlock`); меньше — после
 * нового взноса — недостающее удерживается (`o.edu.lock`).
 */
inline void rebalance_lock(eosio::name coopname, edu_subscription& s) {
  const eosio::asset locked = s.locked_or_zero();
  const eosio::asset required = required_lock(s);
  if (locked > required) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::UNLOCK_FEE,
                   processes::edubridge::ACCESS,
                   locked - required, coopname, s.sub_hash,
                   Memo::get_unlock_fee_memo());
  } else if (locked < required) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::LOCK_FEE,
                   processes::edubridge::ACCESS,
                   required - locked, coopname, s.sub_hash,
                   Memo::get_lock_fee_memo());
  }
  s.set_amounts(s.charged_or_zero(), s.reserved_or_zero(), required);
}

/**
 * @brief Гарантийный срок участника истёк — взнос перестаёт удерживаться целиком.
 *
 * Весь взнос был удержан: возврат по гарантии — полный. Срок истёк, и
 * остаётся только возврат при отказе. Оплата занятий выделяется в резерв
 * преподавателям — остаток за непроведённые и взнос преподавателей за уже
 * проведённые (`o.edu.allot`); удержание уменьшается до суммы возможного
 * возврата (`o.edu.unlock`), остальное остаётся на кошельке программы.
 *
 * Пока срок идёт либо он уже закрыт, ничего не делает.
 *
 * @return true, если гарантийный срок закрыт этим вызовом.
 */
inline bool close_guarantee(eosio::name coopname, const edu_terms& terms, edu_subscription& s, eosio::time_point_sec now) {
  auto& plan = s.plan.value();
  if (plan.released || is_guarantee_running(terms, s, now)) return false;

  const eosio::asset locked = s.locked_or_zero();
  const eosio::asset required = required_lock(s);
  // Сначала освобождается удержанное сверх возможного возврата: из него выделяется резерв.
  if (locked > required) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::UNLOCK_FEE,
                   processes::edubridge::ACCESS,
                   locked - required, coopname, s.sub_hash,
                   Memo::get_unlock_fee_memo());
  }

  const eosio::asset allot = plan.reserve + plan.due;
  if (allot.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::ALLOT_TEACHER_RESERVE,
                   processes::edubridge::ACCESS,
                   allot, coopname, s.sub_hash,
                   Memo::get_allot_reserve_memo());
    update_course(coopname, s.course_id, [&](auto& c) {
      c.reserve += allot;
      check_course_covered(c);
    });
  }

  s.set_amounts(s.charged_or_zero(), plan.reserve, locked > required ? required : locked);
  plan.due = eosio::asset(0, _root_govern_symbol);
  plan.released = true;
  return true;
}

/**
 * @brief Закрытие подписки: расчёт по её остаткам и возврат участнику.
 *
 * Удержанное возвращается на кошелёк программы. Резерв за непроведённые
 * занятия высвобождается туда же (`o.edu.free`). Взнос преподавателей за
 * проведённые занятия, ещё не выделенный в резерв, выделяется (`o.edu.allot`)
 * — преподаватель получает за проведённое при любом исходе подписки. Возврат
 * участнику идёт с кошелька программы и уменьшает собранное по курсу.
 *
 * Строку подписки стирает вызывающее действие.
 */
inline void settle_closing(eosio::name coopname, const edu_subscription& sub, eosio::asset refund, bool to_share) {
  const eosio::asset zero(0, _root_govern_symbol);
  const eosio::asset locked = sub.locked_or_zero();
  const eosio::asset allotted = sub.reserved_or_zero();
  const eosio::asset due = sub.has_plan() ? sub.plan.value().due : zero;

  eosio::check(refund.amount >= 0 && refund <= sub.charged_or_zero(), "Возврат больше собранного по подписке");

  if (locked.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::UNLOCK_FEE,
                   processes::edubridge::ACCESS,
                   locked, coopname, sub.sub_hash,
                   Memo::get_unlock_fee_memo());
  }
  if (allotted.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::FREE_TEACHER_RESERVE,
                   processes::edubridge::ACCESS,
                   allotted, coopname, sub.sub_hash,
                   Memo::get_free_reserve_memo());
  }
  if (due.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::ALLOT_TEACHER_RESERVE,
                   processes::edubridge::ACCESS,
                   due, coopname, sub.sub_hash,
                   Memo::get_allot_reserve_memo());
  }
  if (refund.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::REFUND_FEE,
                   processes::edubridge::ACCESS,
                   refund, sub.username, sub.sub_hash,
                   Memo::get_refund_memo());
    if (to_share) {
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::RETURN_TO_SHARE,
                     processes::edubridge::ACCESS,
                     refund, sub.username, sub.sub_hash,
                     Memo::get_return_to_share_memo());
    }
  }

  if (allotted.amount > 0 || due.amount > 0 || refund.amount > 0) {
    update_course(coopname, sub.course_id, [&](auto& c) {
      eosio::check(allotted <= c.reserve, "Резерв преподавателям по курсу меньше резерва подписки");
      c.reserve -= allotted;
      c.reserve += due;
      eosio::check(refund <= c.collected, "Возврат больше собранного по курсу");
      c.collected -= refund;
      check_course_covered(c);
    });
  }

  if (sub.has_plan()) {
    update_terms(coopname, sub.course_id, [&](auto& t) {
      if (t.subs_active > 0) t.subs_active -= 1;
    });
  }
}

/**
 * @brief По подписке нет занятия, ожидающего расчёта.
 *
 * Пока по открытому занятию курса расчёт с этой подпиской не прошёл, закрыть
 * её нельзя: оплата занятия ушла бы мимо преподавателя.
 */
inline void check_no_pending_lesson(eosio::name coopname, const edu_terms& terms, const edu_subscription& sub) {
  if (terms.open_lesson_id == 0 || !sub.has_plan()) return;
  edu_lessons_index lessons(_edubridge, coopname.value);
  auto lesson = lessons.find(terms.open_lesson_id);
  if (lesson == lessons.end()) return;
  const auto& plan = sub.plan.value();
  const bool covered = plan.paid_from <= lesson->held_at && lesson->held_at < sub.paid_until;
  eosio::check(!covered || plan.last_lesson >= lesson->number,
               "По подписке не завершён расчёт за проведённое занятие");
}

} // namespace Edubridge
