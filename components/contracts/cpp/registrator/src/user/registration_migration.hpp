#pragma once

// ─────────────────────────────────────────────────────────────────────────────
// ВРЕМЕННЫЙ МИГРАЦИОННЫЙ КОД — СНЯТЬ УСЛОВИЕ ПОСЛЕ 30.07.2026.
//
// На момент релиза двухфазного учёта регистрационного взноса (счёт 76,
// кошелёк w.reg.pend) в системе могут быть «зависшие» кандидаты: их платёж
// уже принят кассой (статус `payed`), но ПО СТАРОМУ пути — без операции
// o.reg.inpay, то есть БЕЗ баланса на w.reg.pend.
//
// Когда совет вынесет по ним решение уже на новом контракте:
//   • confirmreg — нельзя делать TRANSFER с пустого w.reg.pend (упадёт
//     «недостаточно средств»); для таких кандидатов признаём взнос по-старому
//     прямым ISSUE (o.reg.putmin / o.reg.payent, Dr 51 / Cr 80|86).
//   • declinereg — возврата через ledger2 нет (как было раньше): on-chain
//     суспенса нет, банковский возврат оформляет бэкенд.
//
// Признак пути — наличие баланса кандидата на w.reg.pend (счёт 76):
//   > 0  → принят по новому пути (o.reg.inpay) → признание/возврат через 76;
//   == 0 → принят до релиза → старый путь.
//
// После 30.07.2026 (когда все зависшие на момент релиза кандидаты гарантированно
// получат решение совета) этот файл и ветвления в confirmreg/declinereg убрать,
// оставив только новый путь.
// ─────────────────────────────────────────────────────────────────────────────

namespace Registrator {

  /**
   * @brief Баланс кандидата на суспенс-кошельке регистрационного взноса
   * (w.reg.pend, счёт 76) из ledger2 L3 (userwallets). Запись существует только
   * пока available > 0 (auto-delete на нуле), поэтому отсутствие = нулевой баланс.
   */
  inline eosio::asset get_registration_pending_balance(eosio::name coopname, eosio::name username) {
    userwallets_index user_wallets(_ledger2, coopname.value);
    auto idx = user_wallets.get_index<"byuserwallet"_n>();
    auto it = idx.find(combine_ids(ledger2_wallets::REGISTRATION_PENDING.value, username.value));
    if (it == idx.end()) return eosio::asset(0, _root_govern_symbol);
    return it->available;
  }

} // namespace Registrator
