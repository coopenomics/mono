
/**
 * Story 3.1: витрина Стола заказов.
 *
 * В MVP — одна дефолтная запись `{id:'default', is_default:true}` на
 * coopname; конструктор кастомных витрин Out-of-MVP. Записи живут
 * как конфигурация (нет on-chain представления), `synchronize:true` в
 * `MarketplaceInfrastructureModule` создаёт таблицу.
 */
export class MarketplaceVitrineEntity {
  public id!: string;

  public coopname!: string;

  public display_name!: string;

  public is_default!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}
