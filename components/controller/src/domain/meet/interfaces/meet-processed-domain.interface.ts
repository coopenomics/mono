// === Processed ===
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

// Доменный интерфейс для обработанных собраний
export interface MeetProcessedDomainInterface {
  coopname: string;
  hash: string;
  presider: string;
  secretary: string;
  presider_certificate?: UserCertificateDomainInterface | null;
  secretary_certificate?: UserCertificateDomainInterface | null;
  results: any[];
  signed_ballots: number;
  quorum_percent: number;
  quorum_passed: boolean;
  decision: ISignedDocument;
  // Агрегат не является частью доменной сущности,
  // он создается временно для передачи в DTO
}
