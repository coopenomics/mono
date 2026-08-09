import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { ProgramKey } from '~/domain/registration/enum';

export interface RegisterParticipantDomainInterface {
  username: string;
  braname?: string;
  privacy_agreement: ISignedDocumentDomainInterface;
  signature_agreement: ISignedDocumentDomainInterface;
  statement: ISignedDocumentDomainInterface;
  user_agreement: ISignedDocumentDomainInterface;
  wallet_agreement: ISignedDocumentDomainInterface;
  /** Опциональное соглашение по благороста (только для individual) */
  blagorost_offer?: ISignedDocumentDomainInterface;
  /** Опциональное соглашение по генератору (для программы generation) */
  generator_offer?: ISignedDocumentDomainInterface;
  /** Опциональная оферта ЦПП «Стол заказов» (для программы marketplace) */
  marketplace_offer?: ISignedDocumentDomainInterface;
  /** Ключ выбранной программы регистрации */
  program_key?: ProgramKey;
}
