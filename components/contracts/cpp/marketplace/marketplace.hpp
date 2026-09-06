#pragma once

#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include <string>
#include <vector>

#include "../lib/index.hpp"
#include "../lib/core/marketplace/marketplace.hpp"
#include "../lib/core/marketplace/memo.hpp"
#include "../lib/core/branch/branch.hpp"
#include "../lib/core/ledger2/ledger2.hpp"

using namespace eosio;
using namespace Marketplace;

/**
 * \ingroup public_contracts
 *
 * @brief Контракт `marketplace` — кооперативный «Стол заказов» в паевой
 * модели (компонент 68, решение владельца 06.09.2026): пайщик вносит паевой
 * взнос под заказ, кооператив закупает имущество, пайщик получает его как
 * возврат паевого взноса по заявлению, протоколу совета и акту.
 *
 * Реализует canonical actions трёх процессов из YAML-стандартов:
 *  - **p.mkt.supply**: createorder, stockorder, cancelorder, expireorder,
 *    acceptorder, declineorder, signsupp, signchair, payout, payconfirm,
 *    paydecline, readyissue, issuestmt, onmktisauth, onmktisdecl, issueact1,
 *    issueact2, cancelissue, recallshare, closeorder, markdown, setfee.
 *  - **p.mkt.return**: submretrn, aprretrem, rejretrem, accretrn, onmktrtauth,
 *    onmktrtdecl, handback, rejretrn.
 *  - **p.mkt.wroff** (4 actions): propwroff, execwroff, onmktwoauth, onmktwodecl.
 *    Cписание скоропорта идёт через канонический паттерн «решение совета»:
 *    backend подписывает Заявление о списании (registry 1106) ключом
 *    кооператива, вызывает `propwroff` (запись wroffprops::proposed) +
 *    `soviet::createagenda(type=mktwroff, callback=onmktwoauth/onmktwodecl)`.
 *    После голосования совета и подписи Протокола (registry 1105) chairman'ом
 *    soviet::exec автоматически вызывает callback `onmktwoauth` (PROPOSED →
 *    AUTHORIZED, сохраняется protocol2) или `onmktwodecl` (PROPOSED → REJECTED).
 *    Только после AUTHORIZED backend циклом по items вызывает `execwroff`
 *    per-item (o.mkt.wroff на каждой позиции).
 *
 * Все per-batch операции на on-chain выполняются per-Order (бэкенд
 * проходит циклом по Order'ам соответствующего batch'а, объединяя их по
 * `batch_hash`). Векторов order_hashes в actions нет — это ограничение
 * на размер транзакции в Antelope (тысячи orders в одной транзакции
 * не пройдут).
 *
 * Все ledger2-движения средств — через `Ledger2::apply(_marketplace, …)`,
 * никаких прямых wallet/account-операций. 13 marketplace-операций
 * зарегистрированы в `lib/core/ledger2/operations.hpp` (`OPERATION_REGISTRY`).
 *
 * Composite-операции (consum+consum2, return+return2, wroff+wroff2) —
 * последовательные `Ledger2::apply` в одной транзакции Antelope (атомарность
 * через single-action wrapper).
 *
 * Авторизация подписей под актами / решениями привязана к кооперативному
 * участку (КУ) через контракт `branch` и helper
 * `Branch::is_user_authorized(coopname, braname, signer)` — председатель
 * КУ может делегировать подпись доверенному лицу из `coobranch.trusted[]`.
 *
 * Источник правды по логике actions, гардам, state-переходам и
 * операциям — три YAML-файла рядом с этим .hpp:
 *  - `p.mkt.supply.standard.yaml`
 *  - `p.mkt.return.standard.yaml`
 *  - `p.mkt.wroff.standard.yaml`
 *
 * Donor-actions старой клиринговой модели (FR19a, AR30) удалены вместе с
 * соответствующими таблицами `Marketplace::request/segment/shipment`.
 */
class [[eosio::contract(MARKETPLACE)]] marketplace : public eosio::contract {

public:
  marketplace(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  // ── p.mkt.supply ─────────────────────────────────────────────────────

  /**
   * @brief Заказчик размещает заказ на товар из каталога (Story 4.1).
   * Паевая модель: внутренний членский кошелёк w.mkt.member расходуется
   * первым — на взнос участка (o.mkt.fee) и на тело заказа (o.mkt.lockm →
   * членский резерв w.mkt.morder); остальное тело — паевой резерв o.mkt.lock
   * (w.wal.share → w.mkt.order, без проводки). Заявления здесь нет:
   * недостающую часть пайщик заранее перевёл действием `convert` по
   * заявлению 1110; членского кошелька обязано хватать на взнос целиком.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void createorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash,
                                      checksum256 offer_hash,
                                      eosio::name offerer,
                                      eosio::name delivery_braname,
                                      eosio::asset quantity,
                                      eosio::asset unit_price,
                                      eosio::asset package_size,
                                      uint32_t warranty_period_secs,
                                      checksum256 batch_hash);

  /**
   * @brief Перевод паевого взноса во внутренний членский кошелёк «Стола
   * заказов» по Заявлению 1110 — отдельная транзакция до заказа, только когда
   * членского кошелька не хватает. Заявление пишется на недостающую сумму
   * («прошу перевести с баланса моего Цифрового кошелька на баланс ЦПП «Стол
   * заказов» N, из них членский взнос M»); по кошелькам здесь двигается
   * только членская часть M: o.mkt.conv (w.wal.share → w.mkt.member) либо
   * o.mkt.convp (w.mkt.share → w.mkt.member при `from_market`), Дт 80 / Кт 86.
   * При amount = 0 действие только публикует заявление.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void convert(eosio::name coopname,
                                 eosio::name orderer,
                                 eosio::asset amount,
                                 bool from_market,
                                 document2 convert_statement);

  /**
   * @brief Заказ из обезличенного остатка склада кооператива (requirement 76).
   * Продавец — сам кооператив (`offerer == coopname`), имущество уже на
   * счёте 10 после ранее закрытых приёмок, поэтому Order создаётся сразу в
   * `acceptcoop` и идёт только через выдачу (readyissue → issuestmt → … →
   * issueact2). Этапы поставки и выплата поставщику для такого заказа не
   * существуют.
   *
   * Заказ из остатка фондируется как обычный, но паевой источник — свободный
   * паевой «Стола заказов» (средства, вернувшиеся за отмены, недовыдачи и
   * гарантийные возвраты): членский кошелёк первым (o.mkt.fee, o.mkt.lockm),
   * остаток тела — o.mkt.lockp (w.mkt.share → w.mkt.order). Недостающую часть
   * пайщик заранее перевёл действием `convert` (o.mkt.convp); при нехватке
   * свободного паевого — отказ.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void stockorder(eosio::name coopname,
                                     eosio::name orderer,
                                     checksum256 order_hash,
                                     checksum256 offer_hash,
                                     eosio::name delivery_braname,
                                     eosio::asset quantity,
                                     eosio::asset unit_price,
                                     eosio::asset package_size,
                                     uint32_t warranty_period_secs,
                                     checksum256 batch_hash);

  /**
   * @brief Заказчик отменяет заказ до акцепта (Story 4.4). Триггерит o.mkt.unlock.
   * Заказ из остатка кооператива (offerer == coopname) отменяется и в
   * `acceptcoop` / `readyrecv` — пока выдача не начата заявлением.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void cancelorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash);

  /**
   * @brief Backend закрывает Order по таймауту цикла отсечки (Story 4.3).
   * Per-Order: o.mkt.unlock + статус active → cancelled. Backend вычисляет
   * threshold по batch'у вне контракта; для каждого истёкшего Order'а
   * вызывается отдельный `expireorder`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void expireorder(eosio::name coopname,
                                      checksum256 order_hash);

  /**
   * @brief Закрыть выданный заказ после выхода гарантийного срока:
   * терминал жизненного цикла, запись стирается из RAM. Вызывается
   * автоматизированной службой по расписанию; до выхода гарантийного
   * срока, при незавершённой выплате поставщику или открытом возврате
   * закрытие отклоняется.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void closeorder(eosio::name coopname,
                                     checksum256 order_hash);

  /**
   * @brief Поставщик акцептует один Order (Story 4.5).
   * Без ledger2-операций — статус active → accepted. Backend проходит циклом
   * по orders соответствующего batch'а, вызывая `acceptorder` per Order.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void acceptorder(eosio::name coopname,
                                      eosio::name offerer,
                                      checksum256 order_hash);

  /**
   * @brief Поставщик отказывается от одного Order'а до акцепта (Story 4.5).
   * Per-Order: o.mkt.unlock на total_cost + статус active → cancelled.
   * Backend проходит циклом по orders батча, вызывая `declineorder` per Order.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void declineorder(eosio::name coopname,
                                       eosio::name offerer,
                                       checksum256 order_hash);

  /**
   * @brief Поставщик первой подписью на АПП приёмки фиксирует партию по одному
   * Order'у (Story 5.3/5.4). Без ledger2-операций — статус accepted →
   * supply_prepared. Параметр `accept_braname` указывает приёмный КУ; запись
   * в Order. Подпись валидируется как `verify_document_or_fail(act, {offerer})`.
   * Backend проходит циклом по orders батча с одинаковым `act`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signsupp(eosio::name coopname,
                                   eosio::name offerer,
                                   checksum256 order_hash,
                                   eosio::name accept_braname,
                                   document2 act);

  /**
   * @brief Председатель приёмного КУ ставит закрывающую подпись на АПП
   * приёмки одного Order'а (Story 5.3/5.4). Per-Order: только o.mkt.purch
   * (Дт 10 / Кт 86). Выплата поставщику (o.mkt.payout) — отдельным lazy
   * action'ом `payout` после подтверждения кассиром фактического банковского
   * перевода (E11 техдолг 598-16, Locked Decision L12). Авторизация подписи:
   * председатель / trustee / trusted ∈ branches[o.accept_braname]. Backend
   * проходит циклом по orders батча с одинаковым `act`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signchair(eosio::name coopname,
                                    eosio::name signer,
                                    checksum256 order_hash,
                                    eosio::asset actual_quantity,
                                    eosio::asset actual_unit_price,
                                    document2 act);

  /**
   * @brief Инициация исходящей выплаты поставщику через контракт gateway по
   * одному Order'у (E11 техдолг 598-16, Locked Decision L12). Per-Order:
   * inline-вызов `gateway::createoutpay` с callback'ами на `payconfirm` /
   * `paydecline`. Ledger2-операция o.mkt.payout (Дт 86 / Кт 51) применяется
   * НЕ здесь, а в callback'е `payconfirm` после действия кассира. Статус
   * Order'а не меняется; защита от двойного запроса — через
   * `order.payout_status` (NONE/DECLINED → PENDING).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void payout(eosio::name coopname,
                                 checksum256 order_hash);

  /**
   * @brief Callback от gateway::outcomplete — кассир подтвердил
   * банковский перевод поставщику (E11 техдолг 598-16, Locked Decision L12).
   * Здесь применяется o.mkt.payout (Дт 86 / Кт 51) и `payout_status`
   * переходит PENDING → COMPLETED. Авторизация: `_gateway`. `outcome_hash`
   * совпадает с `order.hash` (так задано при `payout`).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void payconfirm(eosio::name coopname,
                                     checksum256 outcome_hash);

  /**
   * @brief Callback от gateway::outdecline — кассир отметил, что
   * банковский перевод не состоялся (E11 техдолг 598-16, Locked Decision L12).
   * Ledger2-операция НЕ применяется; обязательство Кт 86 остаётся открытым.
   * `payout_status` PENDING → DECLINED; `payout_decline_reason` сохраняется.
   * Авторизация: `_gateway`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void paydecline(eosio::name coopname,
                                     checksum256 outcome_hash,
                                     std::string reason);

  /**
   * @brief Списание уценки по заказу из остатка кооператива (requirement 76).
   * Разница между стоимостью прибытия выданного и фактической суммой выдачи
   * выбывает со счёта 10 в прочие расходы: o.mkt.loss (NONE, Дт 91 / Кт 10).
   * Вместе с o.mkt.consum даёт выбытие по полной стоимости прибытия — на
   * складе ничего не зависает. Вызывает backend после финализации выдачи
   * (сумму считает по выданным позициям). Погашение накопленного на 91
   * (Дт 86 / Кт 91) — будущий процесс по образцу списания скоропорта.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void markdown(eosio::name coopname,
                                   checksum256 order_hash,
                                   eosio::asset amount);

  /**
   * @brief Установка единой ставки членского взноса «Стола заказов»
   * (requirement b6). Одна ставка на весь кооператив (HUNDR_PERCENTS = 100%);
   * задаёт администратор. Применяется к новым заказам; в созданных заказах
   * взнос зафиксирован полем Order.membership_fee.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void setfee(eosio::name coopname,
                                 uint64_t membership_fee_percent);

  // ── p.mkt.supply: выдача по заявлению, протоколу совета и акту (паевая модель) ──
  /**
   * @brief Оператор участка выдачи отмечает поступление имущества по заказу на
   * свой участок: `acceptcoop → readyrecv`, `current_warehouse_braname` =
   * участок выдачи. Подписи и документов нет — заказчику уходит уведомление,
   * что заказ можно забирать. Заменяет прежнюю первую подпись акта (readyissue).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void readyissue(eosio::name coopname,
                                     eosio::name signer,
                                     checksum256 order_hash);
  /**
   * @brief Заказчик на пункте выдачи подписывает Заявление о возврате паевого
   * взноса имуществом (1113) на фактический состав после сверки:
   * `readyrecv → issuepend`. Факт (количество, цена) фиксируется в заказе;
   * тем же действием контракт инлайн ставит повестку совета
   * (`soviet::createagenda`, тип `mktissue`, hash = order_hash, обратные
   * вызовы onmktisauth / onmktisdecl). Движений по средствам нет; при факте
   * больше заказа заранее проверяется, что на доплату хватает свободного
   * паевого, а на довзнос участка — внутреннего членского кошелька.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void issuestmt(eosio::name coopname,
                                    eosio::name orderer,
                                    checksum256 order_hash,
                                    eosio::asset actual_quantity,
                                    eosio::asset actual_unit_price,
                                    document2 statement,
                                    std::string meta);
  /**
   * @brief Обратный вызов совета: решение о возврате паевого взноса имуществом
   * принято — `issuepend → issueauth`, Протокол (1114) сохраняется в заказе.
   * Единственно допустимая авторизация — `_soviet`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktisauth(eosio::name coopname,
                                      checksum256 hash,
                                      document2 authorization);
  /**
   * @brief Обратный вызов совета: отказ по заявлению либо просрочка повестки —
   * `issuepend → readyrecv`, документы выдачи снимаются, факт возвращается к
   * заказу. Движений по средствам нет.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktisdecl(eosio::name coopname,
                                      checksum256 hash,
                                      std::string reason);
  /**
   * @brief Первая подпись Акта приёма-передачи (1115) заказчиком во исполнение
   * протокола совета: `issueauth → issueact1`. Без движений по средствам.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void issueact1(eosio::name coopname,
                                    eosio::name orderer,
                                    checksum256 order_hash,
                                    document2 act);
  /**
   * @brief Закрывающая подпись Акта приёма-передачи председателем (доверенным,
   * оператором) участка выдачи: `issueact1 → received`. Только здесь идут
   * движения: корректировка по факту (o.mkt.unlock / o.mkt.unlkm при факте
   * меньше, o.mkt.lockp при факте больше), выдача в счёт резерва — членского
   * o.mkt.consm (Дт 86 / Кт 10) первым и паевого o.mkt.consum (Дт 80 / Кт 10)
   * на фактическую сумму, пересчёт членского взноса участка (o.mkt.refund /
   * o.mkt.fee с членского кошелька) и зачисление его участку
   * (branch::accrue). Открывается гарантийное окно; акт публикуется в реестре
   * документов пакетом процесса заказа.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void issueact2(eosio::name coopname,
                                    eosio::name delivery_signer,
                                    checksum256 order_hash,
                                    document2 act);
  /**
   * @brief Оператор участка отменяет начатую выдачу: из `issueauth` /
   * `issueact1` обратно в `readyrecv`; документы выдачи снимаются, резерв не
   * трогается. Из `issuepend` отмена невозможна — повестка совета открыта.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void cancelissue(eosio::name coopname,
                                      eosio::name signer,
                                      checksum256 order_hash);
  /**
   * @brief Пайщик выводит свободный паевой «Стола заказов» в общий паевой
   * Цифрового кошелька: o.mkt.recall (TRANSFER w.mkt.share → w.wal.share, без
   * проводки). Документа не требуется — паевой остаётся паевым.
   * `recall_hash` — идентификатор операции для журнала (process hash).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void recallshare(eosio::name coopname,
                                      eosio::name username,
                                      checksum256 recall_hash,
                                      eosio::asset amount);

  // ── p.mkt.return ─────────────────────────────────────────────────────

  /**
   * @brief Пайщик подаёт заявление на гарантийный возврат (Story 7.1).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void submretrn(eosio::name coopname,
                                    eosio::name orderer,
                                    checksum256 request_hash,
                                    checksum256 original_order_hash,
                                    eosio::asset actual_quantity,
                                    std::string reason_text,
                                    std::vector<checksum256> photos,
                                    document2 statement);

  /**
   * @brief Председатель удалённо одобряет очный визит (Story 7.2). Авторизация:
   * подписант ∈ branches[braname]; параметр `braname` фиксирует КУ, в котором
   * рассматривается заявление.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void aprretrem(eosio::name coopname,
                                    eosio::name signer,
                                    eosio::name braname,
                                    checksum256 request_hash);

  /**
   * @brief Председатель удалённо отказывает (Story 7.2). Авторизация:
   * подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrem(eosio::name coopname,
                                    eosio::name signer,
                                    eosio::name braname,
                                    checksum256 request_hash,
                                    std::string reason);

  /**
   * @brief Оператор участка принимает имущество у стойки (паевая модель):
   * `approvvisit → retpend`. Оператор накладывает вторую подпись на Заявление
   * о внесении паевого взноса имуществом (1116; `statement` несёт обе подписи —
   * заказчика и оператора) и тем же действием контракт ставит повестку совета
   * (`soviet::createagenda`, тип `mktretrn`, hash = request_hash, обратные
   * вызовы onmktrtauth / onmktrtdecl). Движений по средствам нет — баланс
   * заказчика восстанавливается только по решению совета.
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void accretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   document2 statement,
                                   std::string meta);

  /**
   * @brief Председатель отказывает на очном осмотре (Story 7.3).
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   std::string reason);

  /**
   * @brief Обратный вызов совета: имущество принято как паевой взнос —
   * `retpend → ∅`. Одной транзакцией: o.mkt.return (ISSUE w.mkt.share,
   * Дт 10 / Кт 80), возврат членского взноса участка из общего кошелька
   * (branch::retfee) и его сторно заказчику (o.mkt.refund). Запись заявки
   * стирается; протокол (1117) уходит в пакет документов заказа через
   * контракт soviet. Единственно допустимая авторизация — `_soviet`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktrtauth(eosio::name coopname,
                                      checksum256 hash,
                                      document2 authorization);
  /**
   * @brief Обратный вызов совета: отказ в принятии имущества — `retpend →
   * retdecl`. Имущество остаётся на участке и ждёт заказчика; движений нет.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktrtdecl(eosio::name coopname,
                                      checksum256 hash,
                                      std::string reason);
  /**
   * @brief Оператор участка выдал имущество заказчику обратно: из `retdecl`
   * либо из `retpend` по истечении срока ожидания решения совета
   * (RETURN_DECISION_WAIT_SECS). Документа нет — имущество участок юридически
   * не принимал. Запись заявки стирается, заказ остаётся выданным с прежним
   * гарантийным окном. Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void handback(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash);

  // ── p.mkt.wroff ──────────────────────────────────────────────────────

  /**
   * @brief Backend выносит проект списания на повестку совета (Story 8.1).
   * Без ledger2-операций — только создание proposal с N позициями (статус
   * proposed) и тем же inline-вызовом ставит повестку: `soviet::createagenda`
   * от `permission_level{_marketplace, active}` с `callback_contract=marketplace`,
   * `confirm_callback=onmktwoauth`, `decline_callback=onmktwodecl`,
   * `type=mktwroff`, `hash=proposal_hash`, `statement` (Заявление 1106).
   * Проект может подаваться председателем (за подписью) либо автоматически —
   * мост повестки целиком на контракте, без участия backend.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void propwroff(eosio::name coopname,
                                    eosio::name proposed_by,
                                    checksum256 proposal_hash,
                                    std::vector<wroff_item> items,
                                    document2 statement,
                                    std::string meta);

  /**
   * @brief Callback от `soviet::exec` после авторизации Протокола совета
   * (registry 1105) председателем (Story 8.4). PROPOSED → AUTHORIZED;
   * сохраняется `authorization` в `wroffprops.protocol`. Цикл per-item
   * списания запускает backend через `execwroff` после получения этой дельты.
   *
   * Авторизация: контракт `_soviet` (`require_auth(_soviet)`); сигнатура
   * соответствует `authorize_action_effect` в soviet — `(coopname, hash,
   * authorization)`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktwoauth(eosio::name coopname,
                                      checksum256 hash,
                                      document2 authorization);

  /**
   * @brief Callback от `soviet::cancelexprd` (или от любого decline-эффекта в
   * soviet) — повестка отклонена или просрочена (Story 8.4). PROPOSED →
   * REJECTED; `reason` сохраняется в `wroffprops.reject_reason`. Без
   * ledger2-движений.
   *
   * Сигнатура `(coopname, hash, reason)` соответствует
   * `DECLINE_CALLBACK_SIGNATURE` в `lib/core/soviet/soviet.hpp:19`.
   * Авторизация: `_soviet`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktwodecl(eosio::name coopname,
                                      checksum256 hash,
                                      std::string reason);

  /**
   * @brief Backend исполняет одну позицию авторизованного проекта списания
   * (Story 8.4). Per-item: `o.mkt.wroff`, `items[item_index].executed = true`.
   * Когда все items исполнены, статус AUTHORIZED → EXECUTED.
   *
   * Защита от газового лимита (тысячи позиций в одной транзакции Antelope
   * не помещаются) — backend проходит цикл и вызывает `execwroff` per item.
   *
   * Guards:
   *  - proposal.status == AUTHORIZED (callback `onmktwoauth` уже отработал);
   *  - подписант (`signer`) авторизован для КУ-источника
   *    (`branches[items[item_index].braname]`).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void execwroff(eosio::name coopname,
                                    eosio::name signer,
                                    checksum256 proposal_hash,
                                    uint64_t item_index);

  /**
   * @brief Председатель кооперативного участка подтверждает фактическое
   * списание со склада своего КУ по авторизованному советом проекту
   * (ручной шаг стола ПВЗ).
   *
   * Совет лишь принимает решение о допустимости списания (proposed →
   * authorized); фактическое выбытие имущества со склада инициирует
   * председатель КУ, подписывая Служебную записку о списании (registry
   * 1111). Один вызов закрывает все неисполненные позиции одного КУ
   * (`braname`) за одну транзакцию: per-КУ гранулярность разбивает большой
   * проект так, чтобы протокол поместился в лимит транзакции, и привязывает
   * выбытие к подписи ответственного за склад.
   *
   * Эффект:
   *  - Ledger2::apply(o.mkt.wroff) по каждой неисполненной позиции с этим
   *    `braname` (Дт 86 / Кт 10), как в `execwroff`.
   *  - Служебная записка `memo` публикуется в реестр документов
   *    (`make_complete_document`, package = proposal_hash).
   *  - Позиции КУ помечаются executed; когда исполнены все позиции проекта,
   *    запись proposal стирается из RAM (терминал жизненного цикла).
   *
   * Guards:
   *  - proposal.status == AUTHORIZED (совет уже одобрил);
   *  - `signer` уполномочен для КУ `braname`
   *    (`branches[braname].is_user_authorized`) — председатель КУ или его
   *    доверенное лицо;
   *  - у проекта есть хотя бы одна неисполненная позиция этого КУ.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void confirmwroff(eosio::name coopname,
                                       eosio::name signer,
                                       checksum256 proposal_hash,
                                       eosio::name braname,
                                       document2 memo);

  // ── service ──────────────────────────────────────────────────────────

  /**
   * @brief Заглушка миграции — donor-таблиц нет, мигрировать нечего.
   * Оставлена для совместимости с CMake-build и прежним ABI.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void migrate();
};
