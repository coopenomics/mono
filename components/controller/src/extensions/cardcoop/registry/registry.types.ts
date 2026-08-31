/**
 * Документы подключения кооператива к сети «Карта пайщика» (story 7.6, FR-E6, FR-D3).
 *
 * Подключение разложено на два акта по владению данными. Оператор сети знает юридический
 * факт — кооператив принят решением в цепи — и объявляет допуск. Параметры установки
 * (issuer, клиент, адреса) существуют только у самого кооператива, и доносит их он сам.
 * Оба документа подписываются ключом заверения и едут с цепочкой признания — как
 * подтверждения членства.
 */
import type { CardcoopDocumentPayload } from '../attestation/attestation.types';

/** Тип документа реестра. */
export enum CardcoopRegistryDocumentType {
  /** Оператор сети допускает кооператив. */
  Admission = 'coop_admission',
  /** Кооператив доносит параметры своей установки. */
  Connect = 'coop_connect',
}

/** Объявление допуска: подписывает оператор сети. */
export interface CardcoopAdmissionPayload extends CardcoopDocumentPayload {
  type: CardcoopRegistryDocumentType.Admission;
  /** Кого допускают — системное имя кооператива в цепи. */
  subject: string;
  /** Наименование для людей — из записи цепи о кооперативе. */
  display_name: string;
}

/** Параметры установки: подписывает сам кооператив. */
export interface CardcoopConnectPayload extends CardcoopDocumentPayload {
  type: CardcoopRegistryDocumentType.Connect;
  /** Issuer OIDC-провайдера CoopID кооператива — точно как в токенах. */
  oidc_issuer: string;
  /** `client_id` клиента card.coop в authentik кооператива. */
  oidc_client_id: string;
  /** `client_secret` того же клиента. */
  oidc_client_secret: string;
  /** Адрес приёма уведомлений о связках. */
  attestation_callback_url: string;
  /** Адрес выдачи анкеты по гранту (story 9.3). */
  disclosure_url: string;
  /** Адрес возврата «Входа с CardCOOP» (story 9.2): по нему сеть заводит OAuth2-клиента. */
  entry_callback_url: string;
}
