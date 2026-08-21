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

using namespace eosio;
using namespace Edubridge;

/**
 * \ingroup public_contracts
 *
 * @brief Контракт `edubridge` — ЦПП «Образование» (приложение
 * «Образовательный мост»).
 *
 * Реализует actions двух процессов из YAML-стандартов рядом с этим .hpp:
 *  - **p.edu.access** (4 actions): convert, opensub, extendsub, expiresub —
 *    членский взнос за доступ к курсу вносится конвертацией паевого взноса
 *    (w.wal.share → w.edu.member, o.edu.conv) по Заявлению о конвертации;
 *    подписка на курс — рабочее состояние в RAM, стирается по истечении.
 *  - **p.edu.rid** (3 actions): submitrid, acceptrid, declinerid —
 *    преподаватель вносит паевой взнос результатом интеллектуальной
 *    деятельности: заявление → решение совета → акт; средства ISSUE в
 *    главный паевой кошелёк преподавателя (o.edu.rid, Дт 04 / Кт 80).
 *
 * Все действия авторизуются ключом кооператива (`require_auth(coopname)`):
 * пайщик подписывает документ, отправляет его бэкенд кооператива — как
 * `marketplace::convert`. Все движения средств — через `Ledger2::apply`.
 *
 * Источник правды по логике, гардам и операциям:
 *  - `p.edu.access.standard.yaml`
 *  - `p.edu.rid.standard.yaml`
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
   * @brief Продлить подписку: новый срок оплаты строго больше прежнего.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void extendsub(eosio::name coopname,
                                   checksum256 sub_hash,
                                   eosio::time_point_sec paid_until,
                                   checksum256 statement_hash);

  /**
   * @brief Закрыть истёкшую подписку — запись стирается из RAM.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void expiresub(eosio::name coopname,
                                   checksum256 sub_hash);

  // ── p.edu.rid ────────────────────────────────────────────────────────

  /**
   * @brief Преподаватель подаёт Заявление о паевом взносе результатом
   * интеллектуальной деятельности (шаблон 3008). Движений средств нет.
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
   * приёма-передачи (3010). Один шаг ledger2: o.edu.rid (ISSUE →
   * w.wal.share, Дт 04 / Кт 80). Запись заявления стирается.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void acceptrid(eosio::name coopname,
                                   checksum256 rid_hash,
                                   document2 decision,
                                   document2 act);

  /**
   * @brief Отказ совета в приёме РИД по Протоколу (3009). Запись стирается,
   * движений средств нет.
   * @ingroup public_edubridge_actions
   */
  [[eosio::action]] void declinerid(eosio::name coopname,
                                    checksum256 rid_hash,
                                    document2 decision);
};
