#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"

namespace Marketplace {

using namespace eosio;

/**
 * @brief Статусы Order'а в процессе p.mkt.supply.
 *
 * Граф: ∅ → active → терминал-отмена (cancelorder | expireorder | declineorder
 *                    стирают запись из RAM — статуса «отменён» в таблице нет,
 *                    история в журнале действий)
 *                  → accepted → supply_prepared → accepted_to_coop
 *                                               → ready_to_receive → received
 *
 * Источник правды — `p.mkt.supply.standard.yaml` секция `states:`.
 *
 * Промежуточный статус `ship_ready` (после prepship поставщика) удалён:
 * после `acceptorder` поставщик автоматически считается обязанным доставить
 * партию — двойного подтверждения «принял заявку» + «готов отгружать» не
 * требуется (отдельная подпись «готов отгрузить» лишь добавляет шум в UX).
 * Переход accepted → supply_prepared идёт сразу через signsupp.
 */
namespace OrderStatus {
  inline constexpr eosio::name ACTIVE           = "active"_n;
  inline constexpr eosio::name ACCEPTED         = "accepted"_n;
  inline constexpr eosio::name SUPPLY_PREPARED  = "supplyprep"_n;
  inline constexpr eosio::name ACCEPTED_TO_COOP = "acceptcoop"_n;
  inline constexpr eosio::name READY_TO_RECEIVE = "readyrecv"_n;
  inline constexpr eosio::name RECEIVED         = "received"_n;
}

/**
 * @brief Состояние выплаты поставщику по Order'у (Locked Decision L12, E11
 * техдолг 598-16). Выплата идёт через gateway::createoutpay → действие
 * кассира → callback `marketplace::payconfirm` / `marketplace::paydecline`.
 *
 * Допустимые переходы:
 *   none → pending             — `marketplace::payout` отправил inline в gateway.
 *   pending → completed        — gateway::outcomplete → callback `payconfirm`.
 *                                Здесь применяется o.mkt.payout (Дт 86 / Кт 51).
 *   pending → declined         — gateway::outdecline → callback `paydecline`.
 *                                Без ledger-движения; обязательство Кт 86 остаётся.
 *   declined → pending         — повторная попытка `marketplace::payout` после
 *                                исправления реквизитов кассиром.
 */
namespace OrderPayoutStatus {
  inline constexpr eosio::name NONE      = "none"_n;
  inline constexpr eosio::name PENDING   = "pending"_n;
  inline constexpr eosio::name COMPLETED = "completed"_n;
  inline constexpr eosio::name DECLINED  = "declined"_n;
}

/**
 * @brief On-chain Order — анкер процесса p.mkt.supply.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `order.hash` — этот hash используется как `process_hash` во всех ledger2-
 * операциях процесса (BLOCK/UNBLOCK/PURCH/PAYOUT/CONSUM/CONSUM2/RETURN).
 *
 * Привязка к кооперативным участкам (КУ) идёт через `braname` (см. контракт
 * `branch`, таблица `branches`). Председатель / trustee / доверенные лица
 * каждого КУ известны контракту `branch` — авторизация подписей актов
 * выполняется через `Branch::is_user_authorized(coopname, braname, signer)`,
 * а не по сохранённому имени председателя (председатель может делегировать
 * подпись доверенному лицу из `coobranch.trusted[]`, состав которого может
 * меняться независимо от Order'а).
 *
 * Точки контракта:
 *  - `delivery_braname` — КУ выдачи имущества пайщику; задаётся пайщиком на
 *    createorder и неизменна. Источник проверки signiss1/signiss2/p.mkt.return.
 *  - `accept_braname`   — КУ приёмки от поставщика; заполняется на signsupp
 *    как параметр action'а (поставщик указывает, в какой КУ сдаёт партию).
 *    Источник проверки signchair.
 *  - `current_warehouse_braname` — текущая точка хранения имущества по этому
 *    Order'у. Заполняется на signchair (= `accept_braname`, имущество на
 *    приёмном складе) и обновляется на signiss1 (= `delivery_braname`, готово
 *    к выдаче — фиксирует факт логистической передачи). Бездокументарно —
 *    промежуточные перемещения по заготовочным КУ контрактом не подписываются;
 *    точка хранения переходит «скачком» в момент готовности к выдаче.
 *
 * История внутренних передач между КУ (заготовочный → точка выдачи и т.п.)
 * с подписью ТТН — отложена. Backend может реконструировать движение из
 * blockchain_actions если потребуется.
 *
 * `acceptance_act` (АПП приёмки) и `issue_act` (АПП выдачи) хранятся
 * полным document2 — это дублирование в случае batch-поставки (один
 * физический акт → копия в каждом order'е batch'а), но это допустимо для
 * on-chain (минимум данных + hash) и упрощает аудит.
 *
 * `batch_hash` — opaque ссылка на off-chain consolidated request (Locked
 * Decision L10: batch — backend-only сущность). Контракт не валидирует
 * существование batch'а, только хранит ссылку для трассировки и группировки
 * Order'ов в UI. Все per-batch операции на on-chain делаются per-Order
 * (backend проходит циклом по orders батча) — векторов order'ов в action'ах нет.
 *
 * `actual_quantity` / `fact_cost` заполняются на signiss2 (Story 6.2/6.3).
 * До signiss2 равны соответственно `quantity` / `total_cost`.
 *
 * `warranty_until` — рассчитывается в signiss2 как `now() + warranty_period_secs`
 * (period приходит с Offer'а через backend; в `submretrn` валидируется только это поле).
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] order {
  uint64_t id;                                                ///< внутренний ID
  checksum256 hash;                                           ///< process_hash для p.mkt.supply
  eosio::name coopname;                                       ///< scope-валидация
  eosio::name orderer;                                        ///< пайщик-заказчик
  eosio::name offerer;                                        ///< пайщик-поставщик из Offer'а (для acceptorder/declineorder/signsupp guard'а)
  checksum256 offer_hash;                                     ///< ссылка на Offer (off-chain в backend)

  eosio::name delivery_braname;                               ///< КУ выдачи (выбран пайщиком на createorder); проверка signiss1/signiss2/p.mkt.return через Branch::is_user_authorized
  eosio::name accept_braname;                                 ///< КУ приёмки от поставщика (заполняется на signsupp); проверка signchair через Branch::is_user_authorized
  eosio::name current_warehouse_braname;                      ///< текущая точка хранения; signchair: = accept_braname; signiss1: = delivery_braname (фиксация готовности к выдаче)

  eosio::asset quantity = asset(0, _unit_piece);              ///< заказанное количество (asset с символом единицы KG/LTR/PCS, Эпик 17)
  eosio::asset actual_quantity = asset(0, _unit_piece);       ///< фактически выданное (signiss2); до signiss2 == quantity
  eosio::asset package_size = asset(0, _unit_piece);          ///< Эпик 18: содержимое упаковки в базовой единице. 0 = отпуск по мере (unit_price за базовую единицу); >0 = упаковкой (unit_price за упаковку, quantity/actual_quantity кратны package_size)
  eosio::asset unit_price = asset(0, _root_govern_symbol);    ///< цена за единицу отпуска: за базовую единицу (кг/литр/штуку) при package_size==0, либо за упаковку при package_size>0
  eosio::asset total_cost = asset(0, _root_govern_symbol);    ///< quantity * unit_price / 10^precision (заблокированная сумма)
  eosio::asset fact_cost  = asset(0, _root_govern_symbol);    ///< actual_quantity * unit_price / 10^precision (после signiss2)

  uint32_t warranty_period_secs = 0;                          ///< из Offer'а — для submretrn гард'а
  time_point_sec warranty_until = time_point_sec(0);          ///< now() + warranty_period_secs (заполняется в signiss2)

  eosio::name status = OrderStatus::ACTIVE;                   ///< canonical статус
  checksum256 batch_hash;                                     ///< opaque ссылка на consolidated request (off-chain)

  document2 acceptance_act_signsupp;                          ///< АПП приёмки — первая подпись поставщика (signsupp)
  document2 acceptance_act_signchair;                         ///< АПП приёмки — финальная подпись председателя приёмного КУ (signchair)
  document2 issue_act_signiss1;                               ///< АПП выдачи — первая подпись председателя КУ выдачи (signiss1)
  document2 issue_act_signiss2;                               ///< АПП выдачи — финальная подпись заказчика (signiss2)

  eosio::name payout_status = OrderPayoutStatus::NONE;        ///< Locked Decision L12 — состояние выплаты поставщику через gateway (см. namespace OrderPayoutStatus)
  std::string payout_decline_reason;                          ///< Заполняется только при payout_status == DECLINED (текст причины из gateway::outdecline)

  uint64_t return_request_id = 0;                             ///< 0 если активного гарантийного возврата нет

  /**
   * Списанная уценка по заказу из остатка кооператива (o.mkt.loss, Дт 91 / Кт 10):
   * разница между стоимостью прибытия выданного и фактической суммой выдачи.
   * Ноль — уценка не списывалась; это же guard идемпотентности action'а
   * `markdown` (повторное списание по заказу не пройдёт).
   */
  eosio::asset markdown_cost = asset(0, _root_govern_symbol);

  /**
   * Членский взнос по заказу (requirement b6 «Экономика КУ»): считается от
   * единой ставки кооператива на момент создания заказа и блокируется вместе
   * со стоимостью имущества (o.mkt.fee, Дт 80 / Кт 86, пул w.mkt.fee).
   * Включается в общую стоимость заказа для заказчика. При отмене
   * возвращается полностью (o.mkt.refund); при финализации пересчитывается
   * пропорционально факту и распределяется в кошельки КУ (branch::distribute).
   * Ноль — взнос не начислялся.
   */
  eosio::asset membership_fee = asset(0, _root_govern_symbol);

  // Все timestamp'ы переходов состояний (createorder/accepted/received_to_coop/
  // ready/received/cancelled) восстанавливаются на бэкенде из blockchain_actions[at]
  // по соответствующим action'ам — нет смысла держать их в RAM-таблице.
  // Единственное исключение — warranty_until (выше): нужен on-chain для
  // submretrn guard `now() < warranty_until` без cross-action lookup.

  uint64_t primary_key()       const { return id; }
  checksum256 by_hash()        const { return hash; }
  uint64_t by_orderer()        const { return orderer.value; }
  uint64_t by_offerer()        const { return offerer.value; }
  uint64_t by_status()         const { return status.value; }
  checksum256 by_batch()       const { return batch_hash; }
  checksum256 by_offer()       const { return offer_hash; }
  uint64_t by_delivery_bra()   const { return delivery_braname.value; }
  uint64_t by_accept_bra()     const { return accept_braname.value; }
};

typedef eosio::multi_index<
    "orders"_n, order,
    eosio::indexed_by<"byhash"_n,       eosio::const_mem_fun<order, checksum256, &order::by_hash>>,
    eosio::indexed_by<"byorderer"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_orderer>>,
    eosio::indexed_by<"byofferer"_n,    eosio::const_mem_fun<order, uint64_t,    &order::by_offerer>>,
    eosio::indexed_by<"bystatus"_n,     eosio::const_mem_fun<order, uint64_t,    &order::by_status>>,
    eosio::indexed_by<"bybatch"_n,      eosio::const_mem_fun<order, checksum256, &order::by_batch>>,
    eosio::indexed_by<"byoffer"_n,      eosio::const_mem_fun<order, checksum256, &order::by_offer>>,
    eosio::indexed_by<"bydelivbra"_n,   eosio::const_mem_fun<order, uint64_t,    &order::by_delivery_bra>>,
    eosio::indexed_by<"byacceptbra"_n,  eosio::const_mem_fun<order, uint64_t,    &order::by_accept_bra>>>
    orders_index;

} // namespace Marketplace
