/** Запись таблицы `marketplace_handoff_code` — временный код передачи пайщика. */
export class MarketplaceHandoffCodeEntity {
  public id!: string;

  public coopname!: string;

  /** Учётная запись пайщика, которому выдан код. */
  public account!: string;

  /** Сам код: случайная строка, уникальная в кооперативе. */
  public token!: string;

  public issued_at!: Date;

  /** Код действует до этого момента; после него сервер выдаёт новый. */
  public expires_at!: Date;
}
