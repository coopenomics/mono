#pragma once

#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include <string>

#include "../lib/index.hpp"
#include "../lib/core/edubridge/edubridge.hpp"
#include "../lib/core/edubridge/economy.hpp"
#include "../lib/core/ledger2/ledger2.hpp"
#include "../expense/expense.hpp"   // ExpenseDomain::item / callback_handler — для inline-action в шасси расходов

using namespace eosio;
using namespace Edubridge;

/**
 * \ingroup public_contracts
 *
 * @brief Контракт `edubridge` — ЦПП «Образование» (приложение
 * «Образовательный мост»).
 *
 * Реализует actions четырёх процессов из YAML-стандартов рядом с этим .hpp:
 *  - **p.edu.access** (12 actions): setcourse, convert, regstatement,
 *    warrclaim, warrgrant, warrdecline, opensub, chargefee, unlockfee, cancelsub, retshare,
 *    expiresub — членский взнос за доступ к курсу вносится конвертацией
 *    паевого взноса (w.wal.share → w.edu.member, o.edu.conv) по Заявлению о
 *    конвертации и списывается в фонд программы (o.edu.fee). Все суммы
 *    считает контракт по условиям курса (таблица `eduterms`): взнос и
 *    оплаченный срок, удержание по гарантии, резерв преподавателям по
 *    подписке, возврат при отмене (o.edu.refund, o.edu.retshr). Подписка на
 *    курс — рабочее состояние в RAM, стирается по истечении либо отмене.
 *  - **p.edu.spend** (2 actions): createexp, onexpdone — расход программы из
 *    фонда через общее шасси расходов.
 *  - **p.edu.rid** (14 actions): openlesson, chargelesson, droplesson,
 *    holdrid, submitrid, onridauth, onriddecl, signridact, apprvridact,
 *    dclridact, acceptrid, declinerid, recallrid,
 *    wthshare — преподаватель отчитывается по занятию, контракт по одной
 *    подписке за действие считает его взнос (оплата занятия уходит из
 *    резерва подписки), и преподаватель передаёт материалы на
 *    ответственное хранение на эту сумму (o.edu.hold, Дт 08 / Кт 76); по
 *    истечении гарантийного срока курса заявление уходит в совет, и по
 *    решению с актом результат принимается в паевой фонд (o.edu.rid,
 *    Дт 04 / Кт 08, и o.edu.ridshr, w.edu.hold → w.edu.share, Дт 76 / Кт 80).
 *    Рекламация внутри срока и отказ совета снимают материалы с хранения
 *    (o.edu.retrid, Дт 76 / Кт 08). Паевой взнос с кошелька программы
 *    преподаватель переводит в ЦПП «Цифровой Кошелёк» своим заявлением
 *    (o.edu.wthshr, w.edu.share → w.wal.share).
 *  - **p.edu.teach** (6 actions): signcontract, apprvcontr, dclinecontr,
 *    termcontract, setassign, delassign — договор УХД преподавателя подписывается двумя сторонами:
 *    первая подпись преподавателя, вторая — председателя совета через
 *    одобрение (`Soviet::create_approval` → `soviet::confirmapprv` → коллбэк
 *    сюда), как договор в «Благоросте». Допуск преподавателя к курсу и его
 *    ставка на курсе хранятся в таблице `eduassigns`; отдельного документа
 *    у допуска нет. Движений средств нет.
 *
 * Все действия авторизуются ключом кооператива (`require_auth(coopname)`):
 * пайщик подписывает документ, отправляет его бэкенд кооператива — как
 * `marketplace::convert`. Все движения средств — через `Ledger2::apply`.
 *
 * Источник правды по логике, гардам и операциям:
 *  - `p.edu.access.standard.yaml`
 *  - `p.edu.spend.standard.yaml`
 *  - `p.edu.rid.standard.yaml`
 *  - `p.edu.teach.standard.yaml`
 */
class [[eosio::contract(EDUBRIDGE)]] edubridge : public eosio::contract {

public:
  edubridge(eosio::name receiver, eosio::name code,
            eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  // ── p.edu.access ─────────────────────────────────────────────────────

  /**
   * @brief Конвертация паевого взноса пайщика в членский взнос ЦПП
   * «Образование». Один шаг ledger2: o.edu.conv (TRANSFER w.wal.share →
   * w.edu.member, Дт 80 / Кт 86). `statement` — подписанное пайщиком
   * Заявление о конвертации (шаблон 3011), публикуется в реестр документов
   * отдельным пакетом (package = hash заявления).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void convert(eosio::name coopname,
                                 eosio::name username,
                                 eosio::asset amount,
                                 document2 statement);

  /**
   * @brief Задать условия курса: плановую ставку часа, способ расчёта с
   * преподавателем (за каждого участника либо фиксированный за занятие),
   * целевой членский взнос за месяц, расписание, скидку за взнос разом,
   * гарантийный срок и дату начала занятий. По ним контракт считает все суммы.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void setcourse(eosio::name coopname,
                                   uint64_t course_id,
                                   eosio::asset planned_rate,
                                   bool per_learner,
                                   eosio::asset target_fee_month,
                                   uint32_t lessons_per_month,
                                   uint32_t lessons_total,
                                   uint32_t lesson_minutes,
                                   bool course_payment,
                                   uint32_t discount_bp,
                                   uint32_t guarantee_days,
                                   eosio::time_point_sec starts_at);

  /**
   * @brief Открыть подписку на курс для обучающегося. Срок и взнос считает
   * `chargefee`.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void opensub(eosio::name coopname,
                                 eosio::name username,
                                 checksum256 sub_hash,
                                 uint64_t learner_id,
                                 uint64_t course_id,
                                 checksum256 statement_hash);

  /**
   * @brief Членский взнос участника за период (`month` либо `course`). Сумму,
   * оплаченный срок и резерв преподавателям считает контракт; `expected` —
   * сумма из подписанного заявления, расхождение с расчётом — отказ.
   * Движения: o.edu.fee и, пока идёт гарантийный срок участника, o.edu.lock;
   * после срока — o.edu.allot на оплату занятий.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void chargefee(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 sub_hash,
                                   eosio::name period,
                                   eosio::asset expected,
                                   checksum256 statement_hash);

  /**
   * @brief Закрыть гарантийный срок участника: взнос перестаёт удерживаться
   * целиком. Оплата занятий выделяется в резерв преподавателям (o.edu.allot),
   * удержанной остаётся сумма возможного возврата при отказе, остальное —
   * на кошельке программы (o.edu.unlock). Суммы считает контракт.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void unlockfee(eosio::name coopname,
                                   checksum256 sub_hash);

  /**
   * @brief Опубликовать Заявление о взносе (шаблон 3011), целиком покрытом
   * кошельком программы участника: конвертации нет, и `convert` его не
   * публикует. Движений средств нет.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void regstatement(eosio::name coopname,
                                      eosio::name username,
                                      document2 statement);

  /**
   * @brief Опубликовать Заявление об аннулировании Подписки по Гарантийным
   * условиям (шаблон 3013): основание для рассмотрения советом. Взнос
   * участника замораживается до решения совета; подписка остаётся действующей.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void warrclaim(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 sub_hash,
                                   document2 statement);

  /**
   * @brief Совет отказал по заявлению об аннулировании Подписки по Гарантийным
   * условиям: заморозка взноса снимается, подписка продолжает действовать.
   * Гарантийный срок группы уже вышел — оплата занятий участника за
   * гарантийный период остаётся на кошельке программы.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void warrdecline(eosio::name coopname,
                                     eosio::name username,
                                     checksum256 sub_hash);

  /**
   * @brief Решение совета об удовлетворении заявления по Гарантийным условиям
   * (шаблон 3014): подписка аннулируется, весь взнос по ней возвращается в
   * паевой взнос участника. Сумму берёт контракт.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void warrgrant(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 claim_hash,
                                   checksum256 sub_hash,
                                   document2 decision);

  /**
   * @brief Отменить подписку с возвратом членского взноса. Основание и сумму
   * определяет контракт: недобор и отмена до начала занятий — взнос целиком,
   * отказ в ходе подписки — половина остаточной стоимости подписки. Движения:
   * o.edu.refund (кошелёк программы → кошелёк членских взносов участника) и,
   * при недоборе, o.edu.retshr (→ паевой взнос).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void cancelsub(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 sub_hash,
                                   bool underfilled);

  /**
   * @brief Прекратить участие пайщика в ЦПП «Образование» по его заявлению об
   * аннулировании соглашения:
   * весь остаток кошелька программы уходит в паевой (o.edu.retshr, Дт 86 / Кт 80),
   * соглашение о программе аннулируется. Подписки к этому моменту закрыты.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void retshare(eosio::name coopname,
                                  eosio::name username,
                                  eosio::asset amount,
                                  document2 statement);

  /**
   * @brief Закрыть истёкшую подписку — запись стирается из RAM.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void expiresub(eosio::name coopname,
                                   checksum256 sub_hash);

  // ── p.edu.spend ──────────────────────────────────────────────────────

  /**
   * @brief Подать расход программы в шасси расходов. Сумма записки уходит из
   * фонда программы в пул расходов (o.edu.expfnd), дальше расход ведёт шасси:
   * решение совета, оплата или аванс под отчёт, отчёт, закрытие.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void createexp(eosio::name coopname,
                                   eosio::name creator,
                                   eosio::checksum256 expense_hash,
                                   std::vector<ExpenseDomain::item> items,
                                   document2 statement);

  /**
   * @brief Коллбэк шасси: расход завершён. Неизрасходованный остаток
   * возвращается в фонд программы (o.edu.expunf), запись стирается.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void onexpdone(eosio::name coopname,
                                   eosio::checksum256 expense_hash,
                                   uint8_t status,
                                   eosio::asset total_actual,
                                   std::vector<char> data);

  // ── p.edu.rid ────────────────────────────────────────────────────────

  /**
   * @brief Преподаватель передаёт материалы занятия на ответственное хранение
   * по Акту (шаблон 3012). Один шаг ledger2: o.edu.hold (ISSUE → w.edu.hold,
   * Дт 08 / Кт 76) — материалы числятся за преподавателем весь гарантийный
   * срок курса. Запись запоминает курс занятия (`course_id`).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void holdrid(eosio::name coopname,
                                 eosio::name username,
                                 checksum256 rid_hash,
                                 eosio::name rid_type,
                                 std::vector<checksum256> pack,
                                 document2 act);

  /**
   * @brief Преподаватель отчитался о занятии — открыть расчёт с участниками.
   * Фиксирует дату и ставку преподавателя на курсе; длительность — по условиям курса.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void openlesson(eosio::name coopname,
                                    eosio::name username,
                                    checksum256 rid_hash,
                                    uint64_t assignment_id,
                                    eosio::time_point_sec held_at);

  /**
   * @brief Отозвать отчёт о занятии до расчёта с участниками.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void droplesson(eosio::name coopname,
                                    checksum256 rid_hash);

  /**
   * @brief Расчёт за занятие по одной подписке: оплата занятия уходит из
   * резерва подписки, взнос преподавателя по его ставке прибавляется к сумме
   * занятия, разница до плановой ставки поступает на кошелёк программы.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void chargelesson(eosio::name coopname,
                                      checksum256 rid_hash,
                                      checksum256 sub_hash);

  /**
   * @brief Преподаватель подаёт Заявление о паевом взносе результатом
   * интеллектуальной деятельности (шаблон 3008) по истечении гарантийного
   * срока. Движений средств нет.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void submitrid(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 rid_hash,
                                   uint64_t assignment_id,
                                   eosio::asset amount,
                                   eosio::name rid_type,
                                   document2 statement);

  /**
   * @brief Обратный вызов совета: заявление о паевом взносе РИД принято
   * (протокол 3009 подписан председателем). Движений средств нет — паевой
   * фонд признаётся позже, по акту приёма-передачи (`acceptrid`).
   * require_auth(_soviet).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void onridauth(eosio::name coopname,
                                   checksum256 hash,
                                   document2 authorization);

  /**
   * @brief Обратный вызов совета: в приёме паевого взноса РИД отказано либо
   * вопрос снят с повестки. Движений средств нет — материалы с хранения
   * снимает председатель (`recallrid`). require_auth(_soviet).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void onriddecl(eosio::name coopname,
                                   checksum256 hash,
                                   std::string reason);

  /**
   * @brief Преподаватель подписал Акт приёма-передачи РИД (шаблон 3010) —
   * первая подпись. Протокол совета (3009) публикуется в реестр, акт уходит
   * на вторую подпись председателю через одобрение («Запросы одобрений»).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void signridact(eosio::name coopname,
                                    eosio::name username,
                                    checksum256 rid_hash,
                                    document2 decision,
                                    document2 act);

  /**
   * @brief Председатель подписал акт — вторая подпись. Вызывается контрактом
   * совета после подтверждения одобрения: результат принимается в паевой
   * фонд, как в `acceptrid`.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void apprvridact(eosio::name coopname,
                                     eosio::name username,
                                     checksum256 rid_hash,
                                     document2 approved_document);

  /**
   * @brief Председатель отказал в подписи акта — материалы остаются на
   * хранении, заявление закрывает председатель отдельным действием.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void dclridact(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 rid_hash,
                                   std::string reason);

  /**
   * @brief Приём РИД в паевой фонд по Протоколу совета (3009) и Акту
   * приёма-передачи (3010). Два шага ledger2: o.edu.rid (Дт 04 / Кт 08) и
   * o.edu.ridshr (TRANSFER w.edu.hold → w.edu.share, Дт 76 / Кт 80).
   * Третий шаг — o.edu.settle: резерв выплат преподавателям списывается на
   * сумму результата из резерва его курса; при нехватке приём отклоняется.
   * Запись стирается.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void acceptrid(eosio::name coopname,
                                   checksum256 rid_hash,
                                   document2 decision,
                                   document2 act);

  /**
   * @brief Отказ совета в приёме РИД по Протоколу (3009). Материалы снимаются
   * с ответственного хранения (o.edu.retrid, Дт 76 / Кт 08), запись стирается.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void declinerid(eosio::name coopname,
                                    checksum256 rid_hash,
                                    document2 decision);

  /**
   * @brief Снятие материалов занятия с ответственного хранения по рекламации
   * внутри гарантийного срока (o.edu.retrid, Дт 76 / Кт 08). Материалы
   * возвращаются преподавателю, паевой взнос по ним не оформляется.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void recallrid(eosio::name coopname,
                                   checksum256 rid_hash,
                                   std::string reason);

  /**
   * @brief Трансляция паевого взноса преподавателя из ЦПП «Образование» в
   * ЦПП «Цифровой Кошелёк» по его Заявлению (шаблон 3015), на весь остаток
   * или его часть. Один шаг ledger2: o.edu.wthshr (TRANSFER w.edu.share →
   * w.wal.share, без проводки). Возврат паевого взноса идёт уже с Цифрового
   * Кошелька штатным заявлением о возврате.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void wthshare(eosio::name coopname,
                                  eosio::name username,
                                  eosio::asset amount,
                                  document2 statement);

  // ── p.edu.teach ──────────────────────────────────────────────────────

  /**
   * @brief Преподаватель подписывает Договор участия в хозяйственной
   * деятельности (шаблон 3006) — первая подпись. Договор уходит на вторую
   * подпись председателю совета (стол председателя, «Запросы одобрений»);
   * до неё запись в `educontracts` стоит в `pending`.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void signcontract(eosio::name coopname,
                                      eosio::name username,
                                      checksum256 contract_hash,
                                      document2 contract);

  /**
   * @brief Председатель подписал договор — вторая подпись. Вызывается
   * контрактом совета после подтверждения одобрения: договор становится
   * действующим, двухподписный документ публикуется в реестре.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void apprvcontr(eosio::name coopname,
                                    eosio::name username,
                                    checksum256 contract_hash,
                                    document2 approved_document);

  /**
   * @brief Председатель отказал в подписи договора — запись стирается,
   * преподаватель может подписать договор заново.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void dclinecontr(eosio::name coopname,
                                     eosio::name username,
                                     checksum256 contract_hash,
                                     std::string reason);

  /**
   * @brief Допуск преподавателя к курсу и его ставка за час на одного
   * участника; не выше плановой ставки курса. Меняется по ходу курса.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void setassign(eosio::name coopname,
                                   uint64_t assignment_id,
                                   eosio::name username,
                                   uint64_t course_id,
                                   eosio::asset rate);

  /**
   * @brief Снять допуск преподавателя к курсу.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void delassign(eosio::name coopname,
                                   uint64_t assignment_id);

  /**
   * @brief Прекратить Договор участия в хозяйственной деятельности — при
   * выходе преподавателя из кооператива либо по соглашению сторон. Запись
   * стирается; вернувшийся пайщик подписывает договор заново.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void termcontract(eosio::name coopname,
                                      eosio::name username,
                                      checksum256 contract_hash,
                                      std::string reason);

  /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
  [[eosio::action]] void cleanup();
};
