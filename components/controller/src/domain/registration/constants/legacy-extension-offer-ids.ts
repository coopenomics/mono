/**
 * Extension offer agreement ids, сохраняемые в отдельных legacy-колонках candidates.
 * Новые оферты расширений → `program_agreements` (jsonb map по agreement_id).
 */
export const LEGACY_EXTENSION_OFFER_AGREEMENT_IDS = ['blagorost_offer', 'generator_offer'] as const;

export type LegacyExtensionOfferAgreementId = (typeof LEGACY_EXTENSION_OFFER_AGREEMENT_IDS)[number];

export function isLegacyExtensionOfferAgreementId(id: string): id is LegacyExtensionOfferAgreementId {
  return (LEGACY_EXTENSION_OFFER_AGREEMENT_IDS as readonly string[]).includes(id);
}
