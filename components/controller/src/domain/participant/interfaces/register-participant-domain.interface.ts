import type { ISignedDocument } from '@coopenomics/innercoop';
import { ProgramKey } from '~/domain/registration/enum';

/** Ответ заявителя на одну анкету вступления. */
export interface IntakeFormAnswerDomainInterface {
  form_id: string;
  /** Значения полей анкеты: имя поля → значение. Проверяются схемой анкеты. */
  values: Record<string, unknown>;
}

export interface RegisterParticipantDomainInterface {
  username: string;
  braname?: string;
  privacy_agreement: ISignedDocument;
  signature_agreement: ISignedDocument;
  statement: ISignedDocument;
  user_agreement: ISignedDocument;
  wallet_agreement: ISignedDocument;
  /** Опциональное соглашение по благороста (только для individual) */
  blagorost_offer?: ISignedDocument;
  /** Опциональное соглашение по генератору (для программы generation) */
  generator_offer?: ISignedDocument;
  /** Опциональная оферта ЦПП «Стол заказов» (для программы marketplace) */
  marketplace_offer?: ISignedDocument;
  /** Ключ выбранной программы регистрации */
  program_key?: ProgramKey;
  /** Ответы на анкеты вступления, объявленные расширениями */
  intake_answers?: IntakeFormAnswerDomainInterface[];
}
