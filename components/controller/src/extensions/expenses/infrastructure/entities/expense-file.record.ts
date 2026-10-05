import { ExpenseFileKind } from '../../domain/enums/expense-file-kind.enum';

export const EntityName = 'expense_files';

export class ExpenseFileRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  coopname!: string;

  proposal_hash!: string;

  item_hash!: string | null;

  kind!: ExpenseFileKind;

  checksum_sha256!: string;

  mime_type!: string;

  size_bytes!: number;

  storage_key!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  original_filename!: string | null;

  uploaded_by_username!: string;

  uploaded_at!: Date;
}
