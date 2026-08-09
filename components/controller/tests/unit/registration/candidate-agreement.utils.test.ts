import type { CandidateDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import type { ISignedDocument } from '~/domain/document/interfaces/signed-document-domain.interface';
import { MARKETPLACE_OFFER_AGREEMENT_ID } from '~/extensions/marketplace/constants/marketplace-agreement-ids';
import {
  getCandidateAgreementDocument,
  isGenericProgramAgreementId,
} from '~/domain/registration/utils/candidate-agreement.utils';
import { AgreementId } from '~/domain/registration/enum/agreement-id.enum';
import { DocumentType } from '~/domain/registration/enum/document-type.enum';

function makeDoc(hash: string): ISignedDocument {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: { title: 'test', registry_id: 1, lang: 'ru', generator: 'coopjs' } as ISignedDocument['meta'],
    signatures: [],
  };
}

function makeCandidate(
  partial: Partial<CandidateDomainInterface> = {}
): CandidateDomainInterface {
  return {
    username: 'testuser',
    coopname: 'voskhod',
    status: 'pending' as CandidateDomainInterface['status'],
    type: 'individual',
    created_at: new Date(),
    registration_hash: 'abc',
    public_key: 'PUB_K1_test',
    documents: {},
    program_agreements: {},
    ...partial,
  };
}

describe('candidate-agreement.utils', () => {
  it('marketplace_offer — generic program agreement id', () => {
    expect(isGenericProgramAgreementId(MARKETPLACE_OFFER_AGREEMENT_ID)).toBe(true);
  });

  it('blagorost_offer — не generic (legacy column)', () => {
    expect(isGenericProgramAgreementId('blagorost_offer')).toBe(false);
  });

  it('wallet_agreement — платформенное, не generic', () => {
    expect(isGenericProgramAgreementId(AgreementId.WALLET_AGREEMENT)).toBe(false);
  });

  it('getCandidateAgreementDocument читает platform, legacy и program_agreements', () => {
    const walletDoc = makeDoc('wallet-hash');
    const blagorostDoc = makeDoc('blagorost-hash');
    const marketplaceDoc = makeDoc('marketplace-hash');

    const candidate = makeCandidate({
      documents: {
        wallet_agreement: walletDoc,
        blagorost_offer: blagorostDoc,
      },
      program_agreements: {
        [MARKETPLACE_OFFER_AGREEMENT_ID]: marketplaceDoc,
      },
    });

    expect(getCandidateAgreementDocument(candidate, AgreementId.WALLET_AGREEMENT)).toBe(walletDoc);
    expect(getCandidateAgreementDocument(candidate, DocumentType.BLAGOROST_OFFER)).toBe(blagorostDoc);
    expect(getCandidateAgreementDocument(candidate, MARKETPLACE_OFFER_AGREEMENT_ID)).toBe(marketplaceDoc);
    expect(getCandidateAgreementDocument(candidate, 'unknown_offer')).toBeUndefined();
  });
});
