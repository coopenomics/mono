/**
 * Блок реквизитов в подтверждении членства (story 7.7, решение PRD §10 п.8
 * проекта «Карта кооператора»).
 *
 * Устроен так: ФИО (для организации — наименование) идёт открыто, потому что
 * сеть показывает держателя карты человеку, а технический идентификатор для
 * этого бессмыслен. Все остальные поля анкеты уходят пополевыми отпечатками:
 * их значений card.coop не узнаёт, но видит, что поле у двух кооперативов
 * разошлось, и может назвать это поле по имени. Сводного отпечатка на всю
 * анкету нет намеренно — он сказал бы только «где-то расходится», а
 * исправляющему кооперативу нужно знать, где именно.
 */
import { InnerAccountType } from '@coopenomics/innercoop';

/** Открытая часть: как зовут держателя карты. */
export interface CardcoopIdentityPublic {
  /** Физлицо и ИП. */
  last_name?: string;
  first_name?: string;
  middle_name?: string;
  /** Организация. */
  short_name?: string;
  full_name?: string;
}

/**
 * Отпечатки полей: имя поля → sha256 значения.
 *
 * Имена плоские и точечные для вложенных (`passport.series`, `details.inn`),
 * чтобы card.coop мог назвать разошедшееся поле, ничего не зная о форме анкеты.
 */
export type CardcoopIdentityDigests = Record<string, string>;

export interface CardcoopIdentityBlock {
  /** Вид субъекта: от него зависит и состав полей, и что показывать открыто. */
  kind: InnerAccountType;
  public: CardcoopIdentityPublic;
  digests: CardcoopIdentityDigests;
}
