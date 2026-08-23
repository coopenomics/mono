#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include "../lib/index.hpp"

using namespace eosio;
using std::string;

/**
 *  @defgroup public_expense Контракт EXPENSE
 *  @brief Шасси расходов цифрового кооператива (MVP — Благорост).
 *
 *  Универсальный контракт: principal storage = СЗ-расход с массивом items;
 *  кошелёк-источник (пул) приходит параметром source_wallet, ledger2-коды всех
 *  операций жизненного цикла выводятся из него через EXPENSE_OPERATION_SETS
 *  (ledger2/operations.hpp) — подключение нового пула не меняет контракт;
 *  механика оплаты per-item (ADVANCE | DIRECT) выбирает код внутри набора;
 *  callback на финализацию (контракт+action+data) сохраняется при createexp
 *  как переменная — `expense` агностичен к программе-получателю.
 *
 *  See: components/desktop/extensions/expenses/NAMING-C28-28.md (v3).
 */

namespace ExpenseDomain {

  /**
   * @brief Способ оплаты item-а в СЗ.
   *   ADVANCE — пайщик-получатель оплачивает, затем приносит чек.
   *   DIRECT  — кассир/председатель платит организации напрямую.
   */
  enum class Mechanics : uint8_t {
    ADVANCE = 0,
    DIRECT  = 1,
  };

  /**
   * @brief Получатель платежа в item-е.
   *   SELF    — сам создатель СЗ.
   *   MEMBER  — другой пайщик.
   *   ORG     — внешняя организация.
   */
  enum class RecipientType : uint8_t {
    SELF   = 0,
    MEMBER = 1,
    ORG    = 2,
  };

  enum class ProposalStatus : uint8_t {
    CREATED          = 0,  ///< СЗ создан, ждёт подписи signact1 создателя.
    AUTHORIZED       = 1,  ///< СЗ подписан signact2 (совет), готов к оплате.
    PARTIALLY_PAID   = 2,  ///< Часть item-ов оплачена.
    REPORT_SUBMITTED = 3,  ///< Отчёт о расходе подан, ждёт авторизации совета.
    CLOSED           = 4,  ///< СЗ-отчёт авторизован — расход закрыт.
    DECLINED         = 5,  ///< СЗ отклонён до или после авторизации.
  };

  enum class ItemStatus : uint8_t {
    APPROVED  = 0,  ///< Запланирован, ждёт оплаты.
    PAID      = 1,  ///< Оплачен (ADVANCE — выдан пайщику; DIRECT — оплачен организации).
    REPORTED  = 2,  ///< Закрыт отчётом (чек приложен). DIRECT-item получает его сразу при payexp.
    RETURNED  = 3,  ///< Зарезервировано, не используется: returnexp уменьшает actual_amount, статус остаётся PAID до отчёта.
    OVERSPENT = 4,  ///< Зарезервировано, не используется: overspendexp увеличивает actual_amount, статус остаётся PAID до отчёта.
  };

  /**
   * @brief Callback на финализацию — устанавливается при createexp как переменная.
   *
   * Контракт expense не знает про capital/blagorost — он просто вызывает inline
   * action на (contract, action) и прокидывает data наружу. Пустой contract = нет callback.
   *
   * Пример: для расхода в РИД-проект Благороста UI/backend заполняет
   * { "capital"_n, "onexpreport"_n, packed(wip_project_hash) }.
   */
  struct callback_handler {
    eosio::name        contract;
    eosio::name        action;
    std::vector<char>  data;
    EOSLIB_SERIALIZE(callback_handler, (contract)(action)(data))
  };

  /**
   * @brief Item — одна строка СЗ-расхода.
   */
  struct item {
    eosio::checksum256 item_hash;
    uint8_t            mechanics;         ///< Mechanics
    uint8_t            recipient_type;    ///< RecipientType
    eosio::name        recipient;         ///< username (для SELF/MEMBER), либо name-идентификатор (для ORG)
    std::string        description;
    eosio::asset       planned_amount;
    eosio::asset       actual_amount;     ///< 0 пока не оплачено / не отчиталось
    uint8_t            status;            ///< ItemStatus

    EOSLIB_SERIALIZE(item, (item_hash)(mechanics)(recipient_type)(recipient)(description)(planned_amount)(actual_amount)(status))
  };

  /**
   * @brief Таблица СЗ-расходов. Scope = coopname.
   */
  struct [[eosio::table, eosio::contract("expense")]] proposal {
    uint64_t              id;
    eosio::name           coopname;       ///< кооператив (= scope таблицы; дублируем полем по канону)
    eosio::checksum256    proposal_hash;
    eosio::name           username;       ///< создатель
    eosio::name           source_wallet;  ///< семантически — из какого ЦПП/фонда (w.cap.blago, w.sov.expns, …)
    uint8_t               status;         ///< ProposalStatus
    std::vector<item>     items;
    eosio::asset          total_planned;
    eosio::asset          total_actual;
    callback_handler      callback;       ///< опционально; contract.value == 0 = нет callback
    document2             statement_doc;  ///< type=2010, signact1 создателя
    document2             decision_doc;   ///< type=2011, signact2 совета
    eosio::time_point_sec created_at;
    eosio::time_point_sec updated_at;

    uint64_t primary_key()      const { return id; }
    eosio::checksum256 by_hash() const { return proposal_hash; }
    uint64_t by_username()      const { return username.value; }
    uint64_t by_status()        const { return static_cast<uint64_t>(status); }

    EOSLIB_SERIALIZE(proposal,
      (id)(coopname)(proposal_hash)(username)(source_wallet)(status)
      (items)(total_planned)(total_actual)(callback)(statement_doc)(decision_doc)
      (created_at)(updated_at))
  };

  using proposals_index = eosio::multi_index<"proposals"_n, proposal,
    eosio::indexed_by<"byhash"_n,     eosio::const_mem_fun<proposal, eosio::checksum256, &proposal::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<proposal, uint64_t, &proposal::by_username>>,
    eosio::indexed_by<"bystatus"_n,   eosio::const_mem_fun<proposal, uint64_t, &proposal::by_status>>
  >;

} // namespace ExpenseDomain

/**
 *  @ingroup public_contracts
 *  @brief Шасси расходов — 8 actions, MVP только Благорост.
 */
class [[eosio::contract("expense")]] expense : public contract {
public:
    using contract::contract;

    /**
     * @brief Создать и подать СЗ-расход.
     *
     * Создание и подача — одна транзакция (slug createexp). На входе: items + источник
     * (source_wallet) + опц. callback на финализацию.
     * Подписывает создатель (signact1 statement_doc, type=2010).
     *
     * Авторизация: coopname (прямой вызов backend'а) либо контракт-инициатор из
     * contracts_whitelist (inline, например capital::createpgexp).
     * Механика оплаты — per-item (item.mechanics: ADVANCE | DIRECT); ledger2-код
     * операции выводится из механики позиции в момент оплаты payexp.
     *
     * Ставит вопрос в повестку совета (soviet::createagenda, тип createexp):
     * утверждение совета → callback authexp, отклонение → declexp.
     */
    [[eosio::action]]
    void createexp(name coopname, name username,
                   checksum256 proposal_hash,
                   name source_wallet,
                   std::vector<ExpenseDomain::item> items,
                   ExpenseDomain::callback_handler callback,
                   document2 statement);

    /**
     * @brief Авторизовать СЗ советом (signact2 decision_doc, type=2011).
     * Callback решения совета — вызывается только контрактом soviet после
     * голосования и утверждения председателем. После этого расход доступен для оплаты.
     */
    [[eosio::action]]
    void authexp(name coopname, checksum256 proposal_hash, document2 decision);

    /**
     * @brief Отклонить СЗ. Callback решения совета (отрицательный консенсус
     * голосов «против» либо просрочка повестки) — вызывается только контрактом
     * soviet. Возможно только до первой оплаты (CREATED / AUTHORIZED):
     * после payexp средства уже ушли через ledger2, и СЗ завершается обычным
     * путём reportexp / returnexp → closeexp.
     */
    [[eosio::action]]
    void declexp(name coopname, checksum256 proposal_hash, std::string reason);

    /**
     * @brief Оплатить item — выдача аванса (ADVANCE) или прямая оплата организации (DIRECT).
     * Контракт зовёт Ledger2::apply с кодом из набора операций кошелька-источника
     * (EXPENSE_OPERATION_SETS: source_wallet + механика item'а → operation_code).
     * actual_amount не может превышать план item (доплата — через overspendexp).
     * DIRECT-item не имеет фазы подотчёта и помечается REPORTED сразу; когда все
     * items REPORTED — proposal переходит в REPORT_SUBMITTED прямо из payexp.
     */
    [[eosio::action]]
    void payexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                asset actual_amount);

    /**
     * @brief Отчёт о расходе (ADVANCE) — пайщик закрывает item чеком.
     * Зовёт Ledger2::apply(o.exp.advrpt) на остаточный actual item'а (при полном
     * возврате аванса burn пропускается). Когда все items reported — статус
     * proposal становится REPORT_SUBMITTED.
     */
    [[eosio::action]]
    void reportexp(name coopname, checksum256 proposal_hash, checksum256 item_hash);

    /**
     * @brief Закрытие расхода советом — финальный signact2 СЗ-отчёта.
     * Если у proposal заполнен callback — отправляет inline action на (callback.contract, callback.action, callback.data).
     */
    [[eosio::action]]
    void closeexp(name coopname, checksum256 proposal_hash);

    /**
     * @brief Возврат неиспользованного аванса (ADVANCE-остаток).
     * Settlement-запись: уменьшает actual_amount item'а, статус остаётся PAID —
     * фактически потраченная часть закрывается затем штатным reportexp.
     * Зовёт Ledger2::apply(o.exp.advret).
     */
    [[eosio::action]]
    void returnexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                   asset return_amount);

    /**
     * @brief Доплата при перерасходе (ADVANCE).
     * Settlement-запись: увеличивает actual_amount item'а, статус остаётся PAID.
     * Зовёт Ledger2::apply(o.exp.over) — выдача доплаты; закрытие подотчёта на
     * полную сумму (выдано + доплата) делает последующий reportexp.
     */
    [[eosio::action]]
    void overspendexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                      asset overspend_amount);
};
