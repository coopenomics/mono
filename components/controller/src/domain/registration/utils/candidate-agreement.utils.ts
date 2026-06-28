import type { CandidateDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { AgreementId } from '../enum/agreement-id.enum';
import { DocumentType } from '../enum/document-type.enum';
import { isLegacyExtensionOfferAgreementId } from '../constants/legacy-extension-offer-ids';

/** Платформенные соглашения + заявление — фиксированные колонки candidates. */
const PLATFORM_AGREEMENT_IDS = new Set<string>(Object.values(AgreementId));

export function isPlatformAgreementId(agreementId: string): boolean {
  return PLATFORM_AGREEMENT_IDS.has(agreementId);
}

/** Оферта расширения, не legacy-колонка → generic `program_agreements`. */
export function isGenericProgramAgreementId(agreementId: string): boolean {
  return agreementId !== DocumentType.STATEMENT && !isPlatformAgreementId(agreementId) && !isLegacyExtensionOfferAgreementId(agreementId);
}

/**
 * Единая точка чтения подписанного соглашения кандидата по agreement_id
 * из AgreementRegistry (платформенные, legacy capital, generic program_agreements).
 */
export function getCandidateAgreementDocument(
  candidate: CandidateDomainInterface,
  agreementId: string
): ISignedDocumentDomainInterface | undefined {
  if (agreementId === DocumentType.STATEMENT) {
    return candidate.documents?.statement;
  }

  if (isPlatformAgreementId(agreementId)) {
    return candidate.documents?.[agreementId as keyof NonNullable<CandidateDomainInterface['documents']>];
  }

  if (isLegacyExtensionOfferAgreementId(agreementId)) {
    return candidate.documents?.[agreementId];
  }

  return candidate.program_agreements?.[agreementId];
}

export function mapPlatformAgreementIdToDocumentType(agreementId: string): DocumentType | null {
  switch (agreementId) {
    case AgreementId.SIGNATURE_AGREEMENT:
      return DocumentType.SIGNATURE_AGREEMENT;
    case AgreementId.WALLET_AGREEMENT:
      return DocumentType.WALLET_AGREEMENT;
    case AgreementId.USER_AGREEMENT:
      return DocumentType.USER_AGREEMENT;
    case AgreementId.PRIVACY_AGREEMENT:
      return DocumentType.PRIVACY_AGREEMENT;
    default:
      return null;
  }
}

export function mapLegacyExtensionOfferToDocumentType(agreementId: string): DocumentType | null {
  if (agreementId === DocumentType.BLAGOROST_OFFER) return DocumentType.BLAGOROST_OFFER;
  if (agreementId === DocumentType.GENERATOR_OFFER) return DocumentType.GENERATOR_OFFER;
  return null;
}
