import { EduRecipientType } from '../../domain/enums';

/**
 * Обучающийся — сам пайщик или его ребёнок. В приложение не заходит.
 * Контакт (`recipient_value`) — персональные данные: наружу только владельцу,
 * площадке уходит только он и ничего больше.
 */
export class EdubridgeLearnerEntity {
  public id!: string;

  public coopname!: string;

  /** Числовой идентификатор для цепи (uint64): таблицы контракта не знают uuid. */
  public chain_ref!: string;

  /** Пайщик, записавший обучающегося (или сам обучающийся). */
  public member_username!: string;

  public display_name!: string;

  public recipient_type!: EduRecipientType;

  /** Почта / telegram / код пропуска — по типу. */
  public recipient_value!: string;

  public is_self!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}
