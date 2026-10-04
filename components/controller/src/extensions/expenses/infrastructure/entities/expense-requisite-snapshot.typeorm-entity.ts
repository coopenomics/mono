
export const EntityName = 'expense_requisite_snapshots';

/**
 * Снимок реквизитов получателя по строке расхода — фиксируется в момент
 * создания СЗ (как payment_details в gateway-платежах): последующее изменение
 * или удаление платёжного метода пайщиком не меняет то, куда платить по уже
 * поданной смете. Источник реквизитов для поручения бухгалтеру (payexp).
 */
export class ExpenseRequisiteSnapshotTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  coopname!: string;

  proposal_hash!: string;

  item_hash!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  recipient!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  method_id!: string | null;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  method_type!: string | null;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  data!: Record<string, unknown> | null;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  requisites!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  payment_purpose!: string | null;

  created_at!: Date;
}
