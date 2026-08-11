/**
 * Форма применённого действия цепи живёт в контракте
 * `@coopenomics/innercoop`: её читают расширения, следящие за своим
 * контрактом. Здесь она доступна под привычным ядру именем.
 */
export type { InnerChainActionRecord as ActionDomainInterface } from '@coopenomics/innercoop';
