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

/**
 * Председатель совета подписывает акт второй подписью — в «Запросах одобрения»
 * или кнопкой на странице: одобрение одно (решение владельца 08.11.2026).
 */
export function canAcceptProperty(p: MarketplaceInvestPropertyView, isChairman: boolean): boolean {
  return isChairman && p.status === Zeus.MarketplaceInvestPropertyStatus.ACT1
}

/** Сколько заявлений ждут действия этого пайщика — число на пункте меню. */
export function propertyActionsCount(
  properties: MarketplaceInvestPropertyView[],
  who: { username: string; isTrustee: boolean; isChairman: boolean },
): number {
  return properties.filter(
    (p) => canApproveProperty(p, who.isTrustee) || canSignPropertyAct(p, who.username) || canAcceptProperty(p, who.isChairman),
  ).length
}
