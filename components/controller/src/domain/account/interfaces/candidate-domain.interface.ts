import { ISignedDocument } from '@coopenomics/innercoop';
import { ProgramKey, CandidateStatus } from '~/domain/registration/enum';

/**
 * Ответ заявителя на анкету вступления. Заголовок и схема хранятся снимком:
 * совет должен читать ответы с подписями полей и после того, как расширение
 * выключили или поменяли анкету.
 */
export interface CandidateIntakeAnswerDomainInterface {
  values: Record<string, unknown>;
  title: string;
  json_schema: Record<string, unknown>;
  extension_name: string;
  submitted_at: string;
}

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
  /** Ответы на анкеты вступления по идентификатору анкеты. */
  intake_answers?: Record<string, CandidateIntakeAnswerDomainInterface>;
  registration_hash: string;
  referer?: string;
  public_key: string;
  meta?: string;
  program_key?: ProgramKey; // Ключ выбранной программы регистрации
}
