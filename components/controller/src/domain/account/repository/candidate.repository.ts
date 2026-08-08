// domain/account/repository/candidate.repository.ts

import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { CandidateDomainInterface } from '../interfaces/candidate-domain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { DocumentType } from '~/domain/registration/enum';

export interface CandidateRepository {
  findByUsername(username: string): Promise<CandidateDomainInterface | null>;
  findByRegistrationHash(hash: string): Promise<CandidateDomainInterface | null>;
  create(data: CandidateDomainInterface): Promise<CandidateDomainInterface>;
  update(username: string, data: Partial<CandidateDomainInterface>): Promise<CandidateDomainInterface | null>;
  saveDocument(
    username: string,
    documentType: DocumentType,
    document: ISignedDocumentDomainInterface
  ): Promise<void>;
  saveProgramAgreement(
    username: string,
    agreementId: string,
    document: ISignedDocumentDomainInterface
  ): Promise<void>;
  findAllPaginated(
    options: PaginationInputDomainInterface & {
      referer?: string;
    }
  ): Promise<{ items: CandidateDomainInterface[]; totalCount: number }>;
}

export const CANDIDATE_REPOSITORY = Symbol('CandidateRepository');
