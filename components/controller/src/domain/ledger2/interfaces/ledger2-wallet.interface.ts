/**
 * Общекооперативный кошелёк ledger2 (таблица `ledger2::wallets`).
 *
 * Это **не** кошельки пайщиков — те живут в контракте `soviet`. Здесь —
 * пулы средств уровня кооператива:
 *   1001 — расчётный счёт (основной),
 *   2001 — паевой фонд — взносы деньгами,
 *   3001 — вступительные взносы (накопительный),
 *   4001 — sink возвратов/списаний.
 *
 * ID с ×1000 offset (см. Epic 1 Story 1.13).
 */
export interface Ledger2WalletDomainInterface {
  id: number;
  name: string;
  available: string;
  blocked: string;
}
