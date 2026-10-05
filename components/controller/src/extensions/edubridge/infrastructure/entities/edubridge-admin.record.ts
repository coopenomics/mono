
/** Администраторы приложения, назначенные владельцем. Контакты пайщиков им не видны. */
export class EdubridgeAdminRecord {
  public id!: string;

  public coopname!: string;

  public username!: string;

  public appointed_by!: string;

  public created_at!: Date;
}
