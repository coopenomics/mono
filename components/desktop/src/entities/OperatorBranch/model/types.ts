import type { IBranch } from 'src/entities/Branch/model'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'

/**
 * Кооперативный участок, на котором текущий пайщик работает оператором
 * (председатель КУ `trustee` либо его доверенное лицо `trusted` — права
 * по Столу ПВЗ идентичны). Самодостаточная проекция для стола оператора:
 * имя/адрес для шапки, детализация ПВЗ и (если доступна по ролям) полная
 * core-карточка КУ.
 */
export interface IOperatorBranch {
  /** Идентификатор КУ в core (он же `braname`). Служебный — в UI не показываем. */
  braname: string
  /** Человекочитаемое имя КУ (short_name из core); пусто, если ветка недоступна по ролям. */
  name: string
  /** Фактический адрес ПВЗ (из детализации) либо адрес КУ из core. */
  address: string
  /** Текущий пайщик — председатель этого КУ (trustee), а не просто доверенное лицо. */
  isTrustee: boolean
  /** Детализация ПВЗ, если КУ подключён как пункт выдачи (иначе null). */
  details: IMarketplaceKUDetails | null
  /** Полная карточка КУ из core, если доступна по ролям пайщика (иначе null). */
  branch: IBranch | null
}
