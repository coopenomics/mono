/**
 * Документы выдающей стороны раскрытий (story 7.8, FR-F3).
 *
 * Их два: сама анкета, которую кооператив-источник отдаёт кооперативу-получателю напрямую, и
 * отметка о передаче, которая уходит на card.coop. Анкета через card.coop не проходит никогда
 * (PRD §10 п.9, вариант B) — там остаётся только факт: кто у кого взял, когда и по чьему
 * согласию.
 *
 * Поля в snake_case, как и в подтверждениях членства: документ едет между системами и
 * хранится как есть.
 */
import type { InnerAccountType } from '@coopenomics/innercoop';
import type { CardcoopDocumentPayload, CardcoopSignedEnvelope } from '../attestation/attestation.types';

/** Тип документа раскрытия. */
export enum CardcoopDisclosureType {
  /** Анкета держателя, выданная по гранту. */
  Profile = 'disclosure_profile',
  /** Отметка о том, что анкета по гранту передана. */
  Delivered = 'disclosure_delivered',
}

/**
 * Анкета держателя, выданная кооперативу-получателю.
 *
 * Подписана ключом заверения и едет с цепочкой признания — той же, что у подтверждений
 * членства. Получателю не нужно спрашивать ни нас, ни card.coop, чтобы убедиться, что анкету
 * дал признанный сетью кооператив, и что по дороге её не подменили.
 */
export interface CardcoopDisclosurePayload extends CardcoopDocumentPayload {
  type: CardcoopDisclosureType.Profile;
  /** Чья анкета — карта держателя из гранта. */
  card_id: string;
  /** Кому выдана — системное имя кооператива-получателя из гранта. */
  to_coopname: string;
  /**
   * По какому согласию.
   *
   * Внутри подписи, а не только в сопроводительном запросе: без него подписанную анкету можно
   * было бы предъявить как выданную по любому другому гранту.
   */
  grant_jti: string;
  /** Вид субъекта: физлицо, ИП или организация — от него зависит состав анкеты. */
  subject_type: InnerAccountType;
  /** Сама анкета в том виде, в каком её ведёт кооператив (`cooptypes`). */
  profile: Record<string, unknown>;
}

/** Отметка кооператива-источника о передаче анкеты — уходит на card.coop. */
export interface CardcoopDisclosureDeliveredPayload extends CardcoopDocumentPayload {
  type: CardcoopDisclosureType.Delivered;
  /** Согласие, по которому анкета передана; оно же запись журнала card.coop. */
  grant_jti: string;
}

/** Конверт с анкетой — то, что получает кооператив-получатель. */
export type CardcoopDisclosureEnvelope = CardcoopSignedEnvelope<CardcoopDisclosurePayload>;
