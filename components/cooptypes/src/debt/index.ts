/**
 * Реестр обеспечения беспроцентных займов — source of truth в контракте:
 * `components/contracts/cpp/lib/core/debt/collateral.hpp` (`DEBT_COLLATERAL_REGISTRY`).
 *
 * Сам реестр лежит в `collateral.generated.ts` и регенерируется скриптом
 * `pnpm --filter cooptypes gen:from-cpp`. Интерфейс и контроллер читают
 * список кошельков обеспечения отсюда и свой не ведут.
 */
import type { IName } from '../interfaces/ledger2'
import { DEBT_COLLATERAL_REGISTRY } from './collateral.generated'

export { DEBT_COLLATERAL_REGISTRY } from './collateral.generated'
export type { CollateralBasisType, CollateralMeta } from './collateral.generated'

/** Запись реестра по ключу обеспечения; undefined — такого обеспечения нет. */
export function findCollateral(key: IName) {
  return DEBT_COLLATERAL_REGISTRY.find(c => c.key === key)
}

/** Запись реестра по кошельку-источнику обеспечения. */
export function findCollateralBySourceWallet(wallet: IName) {
  return DEBT_COLLATERAL_REGISTRY.find(c => c.source_wallet === wallet)
}
