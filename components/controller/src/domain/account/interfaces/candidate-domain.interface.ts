import { ISignedDocument } from '@coopenomics/innercoop';
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
    statement?: ISignedDocument;
    wallet_agreement?: ISignedDocument;
    signature_agreement?: ISignedDocument;
    privacy_agreement?: ISignedDocument;
    user_agreement?: ISignedDocument;
    /** @deprecated legacy capital — новые оферты → program_agreements */
    blagorost_offer?: ISignedDocument;
    /** @deprecated legacy capital — новые оферты → program_agreements */
    generator_offer?: ISignedDocument;
  };
  /** Подписанные оферты расширений по agreement_id из AgreementRegistry. */
  program_agreements?: Record<string, ISignedDocument>;
  registration_hash: string;
  referer?: string;
  public_key: string;
  meta?: string;
  program_key?: ProgramKey; // Ключ выбранной программы регистрации
}
