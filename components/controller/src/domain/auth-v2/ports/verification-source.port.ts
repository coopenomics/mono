import type { VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';

/**
 * Источник фактов верификации пайщика (фабрика уровней). Каждый уровень
 * верификации живёт в собственном резолвере: `coop_baseline` выводится из
 * членства, `passport_onsite` — из он-чейн записей кооперативного участка,
 * будущий `external_kyc` — из внешнего провайдера. Новый уровень = новый
 * резолвер в наборе `VERIFICATION_SOURCE_RESOLVERS`, ядро не меняется.
 */
export interface IVerificationSourceResolver {
  resolve(username: string, coopname: string): Promise<VerificationTypeEntry[]>;
}

/** Набор источников фактов верификации (инъекция массивом через фабрику модуля). */
export const VERIFICATION_SOURCE_RESOLVERS = Symbol('VerificationSourceResolvers');
