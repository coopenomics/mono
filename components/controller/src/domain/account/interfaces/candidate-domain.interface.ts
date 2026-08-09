import { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { ProgramKey, CandidateStatus } from '~/domain/registration/enum';

/**
 * Домен-интерфейс кандидата в пайщики
 */
export interface CandidateDomainInterface {
  username: string;
  coopname: string;
  braname?: string;
  status: CandidateStatus;
  type: string; // Тип пользователя: individual, organization, entrepreneur
  created_at: Date;
  registered_at?: Date;
  documents?: {
    statement?: ISignedDocumentDomainInterface;
    wallet_agreement?: ISignedDocumentDomainInterface;
    signature_agreement?: ISignedDocumentDomainInterface;
    privacy_agreement?: ISignedDocumentDomainInterface;
    user_agreement?: ISignedDocumentDomainInterface;
    /** @deprecated legacy capital — новые оферты → program_agreements */
    blagorost_offer?: ISignedDocumentDomainInterface;
    /** @deprecated legacy capital — новые оферты → program_agreements */
    generator_offer?: ISignedDocumentDomainInterface;
  };
  /** Подписанные оферты расширений по agreement_id из AgreementRegistry. */
  program_agreements?: Record<string, ISignedDocumentDomainInterface>;
  registration_hash: string;
  referer?: string;
  public_key: string;
  meta?: string;
  program_key?: ProgramKey; // Ключ выбранной программы регистрации
}
