// expense.cpp — шасси расходов (первый потребитель: Благорост).
//
// Принцип: контракт-владелец расходных операций, агностичен к программе-источнику.
// Кошелёк-пул приходит в createexp параметром source_wallet; ledger2-коды всех
// операций жизненного цикла выводятся из него через EXPENSE_OPERATION_SETS
// (фабричная настройка — подключение нового пула не меняет этот контракт).
// Механика оплаты per-item (ADVANCE | DIRECT) выбирает код внутри набора;
// callback-handler сохраняется как переменная.

#include "expense.hpp"

namespace D = ExpenseDomain;

// ── helpers ──────────────────────────────────────────────────────────────────

namespace {

asset zero_like(const asset& a) { return asset{0, a.symbol}; }

asset sum_planned(const std::vector<D::item>& items) {
  if (items.empty()) return asset{0, eosio::symbol{"RUB", 4}};
  asset total = zero_like(items.front().planned_amount);
  for (const auto& it : items) total += it.planned_amount;
  return total;
}

// Набор ledger2-кодов операций шасси по кошельку-источнику СЗ. Один источник =
// один набор (EXPENSE_OPERATION_SETS в ledger2) — в коде expense нет
// захардкоженных operation_code, контракт настраивается на любой пул.
const ExpenseOperationSet& expense_ops_for(eosio::name source_wallet) {
  const auto* set = find_expense_operation_set(source_wallet);
  eosio::check(set != nullptr,
               "Для кошелька-источника не настроен набор операций шасси расходов (EXPENSE_OPERATION_SETS)");
  return *set;
}

D::proposals_index get_proposals(eosio::name self, eosio::name coopname) {
  return D::proposals_index(self, coopname.value);
}

auto find_proposal(D::proposals_index& tbl, const eosio::checksum256& proposal_hash) {
  auto idx = tbl.get_index<"byhash"_n>();
  return idx.find(proposal_hash);
}

void send_callback_if_any(const D::callback_handler& cb,
                          eosio::name coopname,
                          const eosio::checksum256& proposal_hash,
                          uint8_t status,
                          const eosio::asset& amount,
                          eosio::name self) {
  if (cb.contract.value == 0) return;
  // Payload: (coopname, proposal_hash, status, total_actual, data).
  // status = ExpenseDomain::ProposalStatus — инициатор различает CLOSED vs DECLINED.
  // coopname нужен инициатору для скоупа таблиц (capital::progexpenses scope=coopname).
  eosio::action(
    eosio::permission_level{self, "active"_n},
    cb.contract,
    cb.action,
    std::make_tuple(coopname, proposal_hash, status, amount, cb.data)
  ).send();
}

} // namespace

// ── actions ──────────────────────────────────────────────────────────────────

void expense::createexp(name coopname, name username,
                        checksum256 proposal_hash,
                        name source_wallet,
                        std::vector<D::item> items,
                        D::callback_handler callback,
                        document2 statement) {
  // Прямой вызов backend'а — авторизация кооператива; inline от контракта-инициатора
  // (capital::createpgexp и т.п.) — авторизация по whitelist, как в ledger2::apply.
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  verify_document_or_fail(statement, {username});
  eosio::check(!items.empty(), "СЗ должен содержать хотя бы один item");
  eosio::check(ledger2_is_known_wallet(source_wallet),
               "source_wallet не найден в LEDGER2_WALLET_REGISTRY");
  // Источник определяет ledger2-коды всех операций жизненного цикла —
  // отказываем сразу при создании, а не в момент оплаты.
  expense_ops_for(source_wallet);

  auto tbl = get_proposals(get_self(), coopname);
  eosio::check(find_proposal(tbl, proposal_hash) == tbl.get_index<"byhash"_n>().end(),
               "СЗ с таким proposal_hash уже существует");

  // Механика оплаты задаётся на каждом item отдельно (ADVANCE | DIRECT) —
  // в одном СЗ допустимо смешение: ledger2-проводка payexp идёт по-позиционно
  // с кодом, выведенным из механики конкретного item'а.
  for (auto& it : items) {
    eosio::check(it.planned_amount.is_valid() && it.planned_amount.amount > 0,
                 "planned_amount каждого item должен быть положительным");
    eosio::check(it.mechanics <= static_cast<uint8_t>(D::Mechanics::DIRECT),
                 "Неизвестная mechanics item (0 = ADVANCE, 1 = DIRECT)");
    eosio::check(it.recipient_type <= static_cast<uint8_t>(D::RecipientType::ORG),
                 "Неизвестный recipient_type item");

    // Инвариант: пайщик (SELF/MEMBER) получает только аванс под отчёт на личные
    // реквизиты (расходом станет после его отчёта чеком); организация — только
    // прямую оплату по выставленным реквизитам, аванс ей не выдаётся.
    if (it.recipient_type == static_cast<uint8_t>(D::RecipientType::ORG)) {
      eosio::check(it.mechanics == static_cast<uint8_t>(D::Mechanics::DIRECT),
                   "Организации/ИП доступна только оплата по счёту (DIRECT)");
    } else {
      eosio::check(it.mechanics == static_cast<uint8_t>(D::Mechanics::ADVANCE),
                   "Пайщику средства выдаются только авансом под отчёт (ADVANCE)");
      eosio::check(it.recipient != name(),
                   "recipient обязателен для получателя-пайщика");
      eosio::check(is_account(it.recipient),
                   "Аккаунт получателя-пайщика не существует");
    }

    it.status        = static_cast<uint8_t>(D::ItemStatus::APPROVED);
    it.actual_amount = zero_like(it.planned_amount);
  }

  const auto total = sum_planned(items);

  tbl.emplace(get_self(), [&](auto& row) {
    row.id              = tbl.available_primary_key();
    row.coopname        = coopname;
    row.proposal_hash   = proposal_hash;
    row.username        = username;
    row.source_wallet   = source_wallet;
    row.status          = static_cast<uint8_t>(D::ProposalStatus::CREATED);
    row.items           = items;
    row.total_planned   = total;
    row.total_actual    = zero_like(total);
    row.callback        = callback;
    row.statement_doc   = statement;
    row.decision_doc    = document2{};
    row.created_at      = eosio::current_time_point();
    row.updated_at      = row.created_at;
  });

  // СЗ утверждает совет (как возвраты паевых взносов): ставим вопрос в повестку.
  // Утверждение председателем после голосования → callback authexp от _soviet;
  // отклонение (отрицательный консенсус / просрочка) → declexp с причиной.
  ::Soviet::create_agenda(
    _expense,
    coopname,
    username,
    get_valid_soviet_action("createexp"_n),
    proposal_hash,
    _expense,
    "authexp"_n,
    "declexp"_n,
    statement,
    std::string("")
  );
}

void expense::authexp(name coopname, checksum256 proposal_hash, document2 decision) {
  require_auth(_soviet);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::CREATED),
               "Авторизовать можно только СЗ в статусе CREATED");

  verify_document_or_fail(decision);

  idx.modify(it, get_self(), [&](auto& row) {
    row.decision_doc = decision;
    row.status       = static_cast<uint8_t>(D::ProposalStatus::AUTHORIZED);
    row.updated_at   = eosio::current_time_point();
  });
}

void expense::declexp(name coopname, checksum256 proposal_hash, std::string reason) {
  require_auth(_soviet);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  // Отклонение возможно только пока ни один item не оплачен: после payexp деньги
  // уже ушли через ledger2, и decline разъехался бы с учётом инициатора
  // (callback DECLINED возвращает инициатору весь резерв). Частично исполненный
  // СЗ завершается обычным путём: reportexp / returnexp → closeexp.
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::CREATED) ||
               it->status == static_cast<uint8_t>(D::ProposalStatus::AUTHORIZED),
               "Отклонить можно только СЗ без оплат (статусы CREATED / AUTHORIZED)");

  idx.modify(it, get_self(), [&](auto& row) {
    row.status     = static_cast<uint8_t>(D::ProposalStatus::DECLINED);
    row.updated_at = eosio::current_time_point();
  });

  // Callback инициатору (capital::onpgexpdone и т.п.); total_actual здесь всегда 0 —
  // оплат до decline не было (см. проверку статусов выше).
  send_callback_if_any(it->callback, coopname, proposal_hash,
                       static_cast<uint8_t>(D::ProposalStatus::DECLINED),
                       it->total_actual, get_self());
}

void expense::payexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                     asset actual_amount) {
  require_auth(coopname);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::AUTHORIZED) ||
               it->status == static_cast<uint8_t>(D::ProposalStatus::PARTIALLY_PAID),
               "Оплата возможна только из статусов AUTHORIZED / PARTIALLY_PAID");
  eosio::check(actual_amount.is_valid() && actual_amount.amount > 0,
               "actual_amount должен быть положительным");

  bool item_found = false;
  uint8_t paid_mechanics = 0;
  name paid_recipient{};

  idx.modify(it, get_self(), [&](auto& row) {
    bool all_reported = true;
    for (auto& i : row.items) {
      if (i.item_hash == item_hash) {
        eosio::check(i.status == static_cast<uint8_t>(D::ItemStatus::APPROVED),
                     "Item уже оплачен или закрыт");
        eosio::check(actual_amount.symbol == i.planned_amount.symbol,
                     "Символ actual_amount не совпадает с планом item");
        eosio::check(actual_amount.amount <= i.planned_amount.amount,
                     "Сумма оплаты не может превышать план item; доплата сверх плана — через overspendexp");
        i.actual_amount = actual_amount;
        // DIRECT не имеет фазы подотчёта (нет ADVANCE_HOLD): закрывающие документы
        // прикладывает сам кассир, item считается отчитанным сразу после оплаты.
        i.status = static_cast<D::Mechanics>(i.mechanics) == D::Mechanics::DIRECT
          ? static_cast<uint8_t>(D::ItemStatus::REPORTED)
          : static_cast<uint8_t>(D::ItemStatus::PAID);
        paid_mechanics = i.mechanics;
        paid_recipient = i.recipient;
        item_found = true;
      }
      if (i.status != static_cast<uint8_t>(D::ItemStatus::REPORTED)) {
        all_reported = false;
      }
    }
    eosio::check(item_found, "item с заданным hash не найден в СЗ");
    row.total_actual += actual_amount;
    // DIRECT-only СЗ становится готов к закрытию сразу после последней оплаты.
    row.status = all_reported
      ? static_cast<uint8_t>(D::ProposalStatus::REPORT_SUBMITTED)
      : static_cast<uint8_t>(D::ProposalStatus::PARTIALLY_PAID);
    row.updated_at = eosio::current_time_point();
  });

  // ledger2-проводка по механике оплаченного item'а — выдача аванса или прямая
  // оплата; коды выводятся из кошелька-источника СЗ. СЗ может смешивать механики.
  // username нужен ledger2 только для USER_SHARED-стороны (кошелёк-подотчёт) —
  // это ПОЛУЧАТЕЛЬ аванса, не автор СЗ.
  const auto& ops = expense_ops_for(it->source_wallet);
  const auto code = static_cast<D::Mechanics>(paid_mechanics) == D::Mechanics::ADVANCE
    ? ops.advance
    : ops.direct;
  Ledger2::apply(get_self(), coopname, code, actual_amount,
                 paid_recipient, proposal_hash, "expense:payexp");
}

void expense::reportexp(name coopname, checksum256 proposal_hash, checksum256 item_hash) {
  require_auth(coopname);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::PARTIALLY_PAID),
               "Отчёт возможен только по СЗ в статусе PARTIALLY_PAID");

  asset item_amount = asset{0, it->total_actual.symbol};
  bool item_found = false;
  name item_recipient{};

  idx.modify(it, get_self(), [&](auto& row) {
    bool all_reported = true;
    for (auto& i : row.items) {
      if (i.item_hash == item_hash) {
        eosio::check(i.status == static_cast<uint8_t>(D::ItemStatus::PAID),
                     "Отчёт возможен только для оплаченных items");
        eosio::check(static_cast<D::Mechanics>(i.mechanics) == D::Mechanics::ADVANCE,
                     "reportexp применим только к ADVANCE-механике");
        i.status   = static_cast<uint8_t>(D::ItemStatus::REPORTED);
        item_amount = i.actual_amount;
        item_recipient = i.recipient;
        item_found  = true;
      }
      if (i.status != static_cast<uint8_t>(D::ItemStatus::REPORTED)) {
        all_reported = false;
      }
    }
    eosio::check(item_found, "item с заданным hash не найден в СЗ");
    if (all_reported) {
      row.status = static_cast<uint8_t>(D::ProposalStatus::REPORT_SUBMITTED);
    }
    row.updated_at = eosio::current_time_point();
  });

  // ledger2: BURN кошелька-подотчёта на остаточный actual item'а (выдано −
  // возвращено + доплачено), без бухпроводки — проводка уже сделана при выдаче.
  // Подотчёт числится на получателе аванса — его username и закрывает burn.
  // Полный возврат аванса (actual == 0) — burn не нужен, подотчёт уже пуст.
  if (item_amount.amount > 0) {
    Ledger2::apply(get_self(), coopname, expense_ops_for(it->source_wallet).report, item_amount,
                   item_recipient, proposal_hash, "expense:reportexp");
  }
}

void expense::closeexp(name coopname, checksum256 proposal_hash) {
  require_auth(coopname);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::REPORT_SUBMITTED),
               "Закрыть можно только СЗ в статусе REPORT_SUBMITTED");

  idx.modify(it, get_self(), [&](auto& row) {
    row.status     = static_cast<uint8_t>(D::ProposalStatus::CLOSED);
    row.updated_at = eosio::current_time_point();
  });

  // Callback на финализацию (capital::onpgexpdone и т.п.) — если был установлен при createexp.
  send_callback_if_any(it->callback, coopname, proposal_hash,
                       static_cast<uint8_t>(D::ProposalStatus::CLOSED),
                       it->total_actual, get_self());
}

void expense::returnexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                        asset return_amount) {
  require_auth(coopname);

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::PARTIALLY_PAID),
               "Возврат возможен только по СЗ в статусе PARTIALLY_PAID");

  bool item_found = false;
  name item_recipient{};

  idx.modify(it, get_self(), [&](auto& row) {
    for (auto& i : row.items) {
      if (i.item_hash == item_hash) {
        eosio::check(i.status == static_cast<uint8_t>(D::ItemStatus::PAID),
                     "Возврат возможен только из статуса PAID");
        eosio::check(static_cast<D::Mechanics>(i.mechanics) == D::Mechanics::ADVANCE,
                     "returnexp применим только к ADVANCE-механике");
        eosio::check(return_amount.is_valid() &&
                     return_amount.symbol == i.actual_amount.symbol,
                     "Символ return_amount не совпадает с item");
        eosio::check(return_amount.amount > 0 && return_amount.amount <= i.actual_amount.amount,
                     "return_amount должен быть положительным и не превышать actual_amount");
        // Settlement-запись: статус item НЕ меняется (остаётся PAID) — после
        // возврата остатка получатель штатно отчитывается reportexp по
        // фактически потраченной части (при полном возврате — actual == 0).
        i.actual_amount -= return_amount;
        item_recipient = i.recipient;
        item_found = true;
        break;
      }
    }
    eosio::check(item_found, "item с заданным hash не найден в СЗ");
    row.total_actual -= return_amount;
    row.updated_at   = eosio::current_time_point();
  });

  // ledger2: TRANSFER подотчёт → пул-источник (зеркало выдачи аванса).
  // Подотчёт снимается с получателя аванса.
  Ledger2::apply(get_self(), coopname, expense_ops_for(it->source_wallet).refund, return_amount,
                 item_recipient, proposal_hash, "expense:returnexp");
}

void expense::overspendexp(name coopname, checksum256 proposal_hash, checksum256 item_hash,
                           asset overspend_amount) {
  require_auth(coopname);
  eosio::check(overspend_amount.amount > 0, "overspend_amount должен быть положительным");

  auto tbl = get_proposals(get_self(), coopname);
  auto idx = tbl.get_index<"byhash"_n>();
  auto it  = idx.find(proposal_hash);
  eosio::check(it != idx.end(), "СЗ не найден");
  eosio::check(it->status == static_cast<uint8_t>(D::ProposalStatus::PARTIALLY_PAID),
               "Перерасход возможен только по СЗ в статусе PARTIALLY_PAID");

  bool item_found = false;
  name item_recipient{};

  idx.modify(it, get_self(), [&](auto& row) {
    for (auto& i : row.items) {
      if (i.item_hash == item_hash) {
        eosio::check(i.status == static_cast<uint8_t>(D::ItemStatus::PAID),
                     "Перерасход регистрируется только из статуса PAID");
        eosio::check(static_cast<D::Mechanics>(i.mechanics) == D::Mechanics::ADVANCE,
                     "overspendexp применим только к ADVANCE-механике");
        eosio::check(overspend_amount.is_valid() &&
                     overspend_amount.symbol == i.actual_amount.symbol,
                     "Символ overspend_amount не совпадает с item");
        // Settlement-запись: статус item НЕ меняется (остаётся PAID) — подотчёт
        // (теперь на полную сумму выдано + доплата) закрывается штатным reportexp,
        // который сделает burn ADVANCE_HOLD на итоговый actual.
        i.actual_amount += overspend_amount;
        item_recipient = i.recipient;
        item_found = true;
        break;
      }
    }
    eosio::check(item_found, "item с заданным hash не найден в СЗ");
    row.total_actual += overspend_amount;
    row.updated_at   = eosio::current_time_point();
  });

  // ledger2: доплата перерасхода — TRANSFER пул-источник → подотчёт получателя
  // (зеркало выдачи аванса на сумму доплаты). Закрытие на полную сумму — в reportexp.
  Ledger2::apply(get_self(), coopname, expense_ops_for(it->source_wallet).overspend, overspend_amount,
                 item_recipient, proposal_hash, "expense:overspend");
}
