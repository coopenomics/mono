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
 *  - **p.edu.access** (12 actions): convert, regstatement, opensub,
 *    chargefee, lockfee, unlockfee, allotfee, extendsub, freereserve,
 *    cancelsub, retshare, expiresub — членский взнос за доступ к курсу
 *    вносится конвертацией паевого взноса (w.wal.share → w.edu.member,
 *    o.edu.conv) по Заявлению о конвертации и списывается в фонд программы
 *    (o.edu.fee); отмена возвращает взнос по Положению (o.edu.refund,
 *    o.edu.retshr); подписка на курс — рабочее состояние в RAM, стирается по
 *    истечении либо отмене.
 *  - **p.edu.spend** (2 actions): createexp, onexpdone — расход программы из
 *    фонда через общее шасси расходов.
 *  - **p.edu.rid** (5 actions): holdrid, submitrid, acceptrid, declinerid,
 *    recallrid — преподаватель отчитывается по занятию и передаёт материалы
 *    на ответственное хранение (o.edu.hold, Дт 08 / Кт 76); по истечении
 *    гарантийного срока курса заявление уходит в совет, и по решению с актом
 *    результат принимается в паевой фонд (o.edu.rid, Дт 04 / Кт 08, и
 *    o.edu.ridshr, w.edu.hold → w.wal.share, Дт 76 / Кт 80). Рекламация
 *    внутри срока и отказ совета снимают материалы с хранения
 *    (o.edu.retrid, Дт 76 / Кт 08).
 *  - **p.edu.teach** (7 actions): signcontract, apprvcontr, dclinecontr,
 *    signannex, apprvannex, dclineannex, termcontract — договор УХД преподавателя и
 *    приложения к нему на курс подписываются двумя сторонами: первая
 *    подпись преподавателя, вторая — председателя совета через одобрение
 *    (`Soviet::create_approval` → `soviet::confirmapprv` → коллбэк сюда),
 *    как договор и приложения в «Благоросте». Движений средств нет.
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
   * @brief Открыть подписку на курс для обучающегося на оплаченный период.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void opensub(eosio::name coopname,
                                 eosio::name username,
                                 checksum256 sub_hash,
                                 uint64_t learner_id,
                                 uint64_t course_id,
                                 eosio::name period,
                                 eosio::time_point_sec paid_until,
                                 checksum256 statement_hash);

  /**
   * @brief Списать членский взнос ученика в фонд программы. Один шаг ledger2:
   * o.edu.fee (TRANSFER w.edu.member → w.edu.fund, без проводки — оба на 86).
   * Вызывается при открытии и продлении подписки: стоимость подписки уходит в
   * распоряжение кооператива (Положение ЦПП «Образование», п. 4.2.2).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void chargefee(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 sub_hash,
                                   eosio::asset amount);

  /**
   * @brief Удержать взнос до конца гарантийного срока курса. Один шаг ledger2:
   * o.edu.lock (TRANSFER w.edu.fund → w.edu.escrow, без проводки — оба на 86).
   * Пока срок идёт, участник вправе закрыть подписку с возвратом, и на расходы
   * программы этот взнос не идёт.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void lockfee(eosio::name coopname,
                                 checksum256 sub_hash,
                                 eosio::asset amount);

  /**
   * @brief Разблокировать взнос по истечении гарантийного срока курса. Один шаг
   * ledger2: o.edu.unlock (TRANSFER w.edu.escrow → w.edu.fund).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void unlockfee(eosio::name coopname,
                                   checksum256 sub_hash,
                                   eosio::asset amount);

  /**
   * @brief Выделить долю собранного взноса в резерв выплат преподавателям.
   * Один шаг ledger2: o.edu.allot (TRANSFER w.edu.fund → w.edu.teach, без
   * проводки — оба на 86). В фонде остаются свободные средства программы.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void allotfee(eosio::name coopname,
                                  checksum256 sub_hash,
                                  eosio::asset amount);

  /**
   * @brief Высвободить резерв выплат преподавателям обратно в фонд при отмене
   * подписки. Один шаг ledger2: o.edu.free (TRANSFER w.edu.teach → w.edu.fund).
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void freereserve(eosio::name coopname,
                                     checksum256 sub_hash,
                                     eosio::asset amount);

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
   * @brief Продлить подписку: новый срок оплаты строго больше прежнего.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void extendsub(eosio::name coopname,
                                   checksum256 sub_hash,
                                   eosio::time_point_sec paid_until,
                                   checksum256 statement_hash);

  /**
   * @brief Отменить подписку с возвратом членского взноса. Движения ledger2:
   * o.edu.refund (фонд → кошелёк ЦПП ученика) и, при `to_share`, o.edu.retshr
   * (кошелёк ЦПП → паевой). Сумму возврата считает кооператив по Положению ЦПП.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void cancelsub(eosio::name coopname,
                                   eosio::name username,
                                   checksum256 sub_hash,
                                   eosio::asset refund,
                                   bool to_share);

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
   * срок курса.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void holdrid(eosio::name coopname,
                                 eosio::name username,
                                 checksum256 rid_hash,
                                 uint64_t assignment_id,
                                 eosio::asset amount,
                                 eosio::name rid_type,
                                 eosio::time_point_sec hold_until,
                                 document2 act);

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
   * @brief Приём РИД в паевой фонд по Протоколу совета (3009) и Акту
   * приёма-передачи (3010). Два шага ledger2: o.edu.rid (Дт 04 / Кт 08) и
   * o.edu.ridshr (TRANSFER w.edu.hold → w.wal.share, Дт 76 / Кт 80).
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
   * @brief Преподаватель подписывает Приложение к договору УХД на курс
   * (шаблон 3007) — первая подпись. Нужен действующий договор. Приложение
   * уходит на вторую подпись председателю.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void signannex(eosio::name coopname,
                                   eosio::name username,
                                   uint64_t course_id,
                                   checksum256 annex_hash,
                                   document2 annex);

  /**
   * @brief Председатель подписал приложение — двухподписный документ
   * публикуется в реестре, запись ожидания стирается; назначение
   * преподавателя на курс действует.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void apprvannex(eosio::name coopname,
                                    eosio::name username,
                                    checksum256 annex_hash,
                                    document2 approved_document);

  /**
   * @brief Председатель отказал в подписи приложения — запись стирается.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void dclineannex(eosio::name coopname,
                                     eosio::name username,
                                     checksum256 annex_hash,
                                     std::string reason);

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
};
