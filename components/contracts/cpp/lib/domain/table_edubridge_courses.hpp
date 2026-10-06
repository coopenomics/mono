#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/ram_payer.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Учёт средств курса ЦПП «Образование».
 *
 * Кошельки программы в книге учёта общие на кооператив: фонд (w.edu.fund) и
 * резерв выплат преподавателям (w.edu.teach) не знают, какому курсу
 * принадлежат средства. Эта таблица делит их по курсам: результат
 * преподавателя оплачивается только из резерва своего курса (`acceptrid`),
 * средства других курсов на него не идут.
 *
 * scope = coopname; primary_key = course_id — номер курса приложения, тот же,
 * что в `edu_subscription::course_id`. Строка заводится при первом движении
 * по курсу и не стирается: суммы курса живут дольше его подписок.
 *
 * Целевой членский взнос по курсу не хранится: он равен
 * `collected − reserve − settled`.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_course {
  uint64_t course_id;      ///< курс (off-chain id приложения), тот же, что в edu_subscription.course_id
  eosio::asset collected;  ///< всего собрано взносов учеников по курсу (o.edu.fee) за вычетом возвратов (o.edu.refund)
  eosio::asset reserve;    ///< остаток резерва выплат преподавателям курса (o.edu.allot − o.edu.free − o.edu.settle)
  eosio::asset settled;    ///< выплачено преподавателям курса (o.edu.settle)

  uint64_t primary_key() const { return course_id; }
};

typedef eosio::multi_index<"educourses"_n, edu_course> edu_courses_index;

} // namespace Edubridge

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Edubridge::edu_course, cooperative);
