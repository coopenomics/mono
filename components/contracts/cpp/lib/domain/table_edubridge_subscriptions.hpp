#pragma once

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include <vector>

#include "../consts.hpp"
#include "../core/ram_payer.hpp"

namespace Edubridge {

using namespace eosio;

/**
 * @brief Периоды подписки на курс ЦПП «Образование».
 */
namespace SubscriptionPeriod {
  inline constexpr eosio::name MONTH  = "month"_n;
  inline constexpr eosio::name COURSE = "course"_n; ///< взнос разом за весь курс
  inline constexpr eosio::name YEAR   = "year"_n;   ///< у подписок, открытых до взноса за курс

  inline bool is_valid(eosio::name period) {
    return period == MONTH || period == COURSE || period == YEAR;
  }
}

/**
 * @brief Учёт занятий по подписке — по нему контракт считает расчёт с
 * преподавателем и возврат участнику.
 *
 * При оплате в `reserve` откладывается оплата занятий по плановой ставке
 * курса. Каждое проведённое занятие уменьшает остаток (`chargelesson`), так
 * что в любой момент известно, сколько по этой подписке ещё не проведено.
 */
/// Взнос преподавателя за занятия гарантийного срока, ещё не выделенный: по допуску преподавателя.
struct edu_due {
  uint64_t assignment_id = 0;  ///< допуск преподавателя
  eosio::asset amount;         ///< взнос преподавателя за занятия, проведённые участнику в гарантийный срок

  EOSLIB_SERIALIZE(edu_due, (assignment_id)(amount))
};

struct edu_sub_plan {
  uint8_t version = 0;               ///< 1 — учёт занятий ведётся; 0 — подписка открыта до его появления
  eosio::time_point_sec paid_from;   ///< с какого дня идёт оплаченный срок
  uint32_t lessons_paid = 0;         ///< занятий оплачено всеми взносами
  uint32_t lessons_done = 0;         ///< занятий, по которым прошёл расчёт
  uint32_t last_lesson = 0;          ///< номер последнего занятия курса, рассчитанного по этой подписке
  eosio::asset reserve;              ///< остаток оплаты занятий по плановой ставке — за непроведённые занятия
  eosio::asset due;                  ///< взнос преподавателей за проведённые занятия, ещё не выделенный в резерв: гарантийный срок идёт, взнос удержан целиком
  bool released = false;             ///< гарантийный срок группы по подписке закрыт: оплата занятий выделена в резерв, удерживается только сумма возможного возврата
  std::vector<edu_due> dues;         ///< тот же `due` по допускам преподавателей: при закрытии гарантийного срока переходит в их суммы за гарантийный период
  bool claimed = false;              ///< подано заявление об аннулировании по гарантийным условиям: взнос заморожен до решения совета

  /// Взнос преподавателя за занятие гарантийного срока — к сумме допуска.
  void add_due(uint64_t assignment_id, const eosio::asset& amount) {
    due += amount;
    for (auto& d : dues) {
      if (d.assignment_id == assignment_id) { d.amount += amount; return; }
    }
    dues.push_back(edu_due{assignment_id, amount});
  }

  /// Взнос преподавателей за гарантийный срок по подписке не выделяется: участник вернул взнос либо совет отказал после срока.
  void drop_dues() {
    due = eosio::asset(0, due.symbol);
    dues.clear();
  }

  EOSLIB_SERIALIZE(edu_sub_plan, (version)(paid_from)(lessons_paid)(lessons_done)(last_lesson)(reserve)(due)(released)(dues)(claimed))
};

/**
 * @brief Активная подписка пайщика на курс — анкер процесса p.edu.access.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `sub_hash` — этот hash используется как `process_hash` в ledger2-операции
 * конвертации (o.edu.conv) и в документах процесса.
 *
 * В RAM живут только активные подписки: `expiresub` стирает запись по
 * истечении `paid_until` (chain-RAM — рабочее состояние, история — у
 * парсера в blockchain_actions/blockchain_deltas). Статуса в таблице нет.
 *
 * `learner_id` / `course_id` — идентификаторы обучающегося и курса в
 * приложении «Образовательный мост»; контракт их не интерпретирует.
 */
struct [[eosio::table, eosio::contract(EDUBRIDGE)]] edu_subscription {
  uint64_t id;                       ///< внутренний ID
  checksum256 sub_hash;              ///< process_hash для p.edu.access
  eosio::name username;              ///< пайщик-плательщик (ученик)
  uint64_t learner_id;               ///< обучающийся (off-chain id приложения)
  uint64_t course_id;                ///< курс (off-chain id приложения)
  eosio::name period;                ///< период оплаты: month | course (year — у прежних подписок)
  eosio::time_point_sec paid_until;  ///< оплачено до
  checksum256 statement_hash;        ///< hash последнего Заявления о конвертации, по которому оплачен период
  eosio::time_point_sec created_at;  ///< открытие подписки
  eosio::time_point_sec updated_at;  ///< последнее продление
  // Поля добавлены в ХВОСТ struct и обёрнуты в binary_extension: подписки,
  // записанные до их появления, иначе перестают читаться. Значение читать
  // только через asset_or_zero — пустое расширение материализуется при первой
  // же записи строки как asset() без символа.
  eosio::binary_extension<eosio::asset> charged;  ///< собрано по подписке в фонд программы (o.edu.fee) — потолок возврата при отмене
  eosio::binary_extension<eosio::asset> reserved; ///< из собранного выделено в резерв выплат преподавателям (o.edu.allot) — потолок высвобождения
  eosio::binary_extension<eosio::asset> locked;   ///< удержано до конца гарантийного срока курса (o.edu.lock); возвращается в фонд по истечении срока, при отмене и закрытии подписки
  eosio::binary_extension<edu_sub_plan> plan;     ///< учёт занятий по подписке; читать через has_plan()

  /// Учёт занятий ведётся: подписка открыта действием `opensub` после его появления.
  /// Пустое расширение материализуется при записи строки с нулевой версией.
  bool has_plan() const { return plan.has_value() && plan.value().version == 1; }

  /// Учёт собранного ведётся с открытия подписки. У подписок, открытых до его
  /// появления, расширение пусто либо материализовано без символа — потолки
  /// возврата и резерва к ним не применяются.
  bool is_tracked() const {
    return charged.has_value() && charged.value().symbol == _root_govern_symbol;
  }

  eosio::asset charged_or_zero()  const { return asset_or_zero(charged); }
  eosio::asset reserved_or_zero() const { return asset_or_zero(reserved); }
  /// Удержанное считается с нуля у любой подписки: оно не зависит от того, что было собрано раньше.
  eosio::asset locked_or_zero()   const { return asset_or_zero(locked); }

  /// Расширения пишутся только вместе: пустое материализуется без символа.
  void set_amounts(const eosio::asset& charged_, const eosio::asset& reserved_, const eosio::asset& locked_) {
    charged.emplace(charged_);
    reserved.emplace(reserved_);
    locked.emplace(locked_);
  }

  /// Значение расширения либо ноль в символе кооператива.
  static eosio::asset asset_or_zero(const eosio::binary_extension<eosio::asset>& v) {
    if (!v.has_value() || v.value().symbol != _root_govern_symbol) {
      return eosio::asset(0, _root_govern_symbol);
    }
    return v.value();
  }

  uint64_t primary_key()      const { return id; }
  checksum256 by_hash()       const { return sub_hash; }
  uint64_t by_username()      const { return username.value; }
  uint64_t by_paid_until()    const { return static_cast<uint64_t>(paid_until.sec_since_epoch()); }
};

typedef eosio::multi_index<
    "edusubs"_n, edu_subscription,
    eosio::indexed_by<"byhash"_n,      eosio::const_mem_fun<edu_subscription, checksum256, &edu_subscription::by_hash>>,
    eosio::indexed_by<"byusername"_n,  eosio::const_mem_fun<edu_subscription, uint64_t,    &edu_subscription::by_username>>,
    eosio::indexed_by<"bypaiduntil"_n, eosio::const_mem_fun<edu_subscription, uint64_t,    &edu_subscription::by_paid_until>>>
    edu_subscriptions_index;

} // namespace Edubridge

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Edubridge::edu_subscription, cooperative);
