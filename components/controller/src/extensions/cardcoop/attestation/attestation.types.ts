/**
 * Документы, которые кооператив выпускает в сеть «Карта пайщика» (story 7.2).
 *
 * Форма — договор между двумя реализациями: здесь составляют и подписывают,
 * card.coop принимает и проверяет. Поля в snake_case, как в удостоверении
 * пайщика CoopID: документ едет между системами и хранится как есть,
 * переименовывать его поля по дороге в свой стиль значило бы завести второй
 * словарь для одной и той же бумаги.
 */
import type { CardcoopIdentityBlock } from '../identity/identity.types';

/** Тип документа: подпись доказывает не только авторство, но и то, что подписано именно это. */
export enum CardcoopAttestationType {
  Membership = 'membership',
  Revocation = 'revocation',
}

/** Подтверждение членства пайщика. */
export interface CardcoopMembershipPayload {
  type: CardcoopAttestationType.Membership;
  /** Кооператив-издатель; сверяется с тем, кем заканчивается цепочка признания. */
  coopname: string;
  /** Карта держателя — её идентификатор кооператив узнаёт из уведомления о связке. */
  card_id: string;
  /** Дата вступления в кооператив, `YYYY-MM-DD`. */
  member_since: string;
  /** Момент выпуска документа, ISO-8601 UTC. */
  issued_at: string;
  /** Сеть, в которой действует документ: защита от переноса между подсетью и главной цепью. */
  chain_id: string;
  /** Реквизиты держателя: ФИО открыто, остальные поля отпечатками (story 7.7). */
  identity: CardcoopIdentityBlock;
}

/** Отзыв ранее выданного подтверждения (story 7.3). */
export interface CardcoopRevocationPayload {
  type: CardcoopAttestationType.Revocation;
  coopname: string;
  /**
   * Отзываемое подтверждение.
   *
   * Внутри подписи, а не только в адресе запроса: подписанный отзыв без указания
   * цели можно было бы применить к любому подтверждению того же кооператива.
   */
  attestation_id: string;
  issued_at: string;
  chain_id: string;
}

/** Конверт, в котором документ уезжает: сам документ, подпись и цепочка признания. */
export interface CardcoopSignedEnvelope {
  payload: CardcoopMembershipPayload | CardcoopRevocationPayload;
  /** Подпись `SIG_K1_…` ключом заверения кооператива. */
  signature: string;
  /** Цепочка признания от корня к кооперативу — заверения целиком. */
  chain: readonly string[];
}
