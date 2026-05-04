/**
 * Общекооперативный кошелёк ledger2 (таблица `ledger2::wallets`).
 *
 * Это **не** кошельки пайщиков — те живут в контракте `soviet`. Здесь —
 * аналитические разрезы бухгалтерских счетов уровня кооператива.
 *
 * `id` — eosio::name-идентификатор `w.<contract>.<waltype>` (например
 * `w.wal.share`, `w.cap.bginv`, `w.reg.entry`). Полный реестр — в
 * `cooptypes/ledger2/wallets.ts` и `contracts/cpp/lib/core/ledger2/wallets.hpp`.
 */
export interface Ledger2WalletDomainInterface {
  id: string;
  name: string;
  available: string;
  blocked: string;
}
