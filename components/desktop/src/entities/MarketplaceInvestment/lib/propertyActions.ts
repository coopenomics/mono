import { Zeus } from '@coopenomics/sdk'
import type { MarketplaceInvestPropertyView } from '../api'

/**
 * Что пайщик должен сделать с заявлением на паевой взнос имуществом. Одни и те
 * же условия решают, какие кнопки стоят в строке на странице «Инициаторы
 * участка», и сколько дел показывает число на пункте меню — поэтому они в
 * одном месте.
 */

/** Председатель участка одобряет поданное заявление (или отказывает). */
export function canApproveProperty(p: MarketplaceInvestPropertyView, isTrustee: boolean): boolean {
  return isTrustee && p.status === Zeus.MarketplaceInvestPropertyStatus.CREATED
}

/** Вносящий подписывает акт после решения совета. */
export function canSignPropertyAct(p: MarketplaceInvestPropertyView, username: string): boolean {
  return p.username === username && p.status === Zeus.MarketplaceInvestPropertyStatus.AUTHORIZED
}

/** Председатель участка принимает имущество второй подписью акта. */
export function canAcceptProperty(p: MarketplaceInvestPropertyView, isTrustee: boolean): boolean {
  return isTrustee && p.status === Zeus.MarketplaceInvestPropertyStatus.ACT1
}

/** Сколько заявлений ждут действия этого пайщика — число на пункте меню. */
export function propertyActionsCount(properties: MarketplaceInvestPropertyView[], username: string, isTrustee: boolean): number {
  return properties.filter((p) => canApproveProperty(p, isTrustee) || canSignPropertyAct(p, username) || canAcceptProperty(p, isTrustee)).length
}
