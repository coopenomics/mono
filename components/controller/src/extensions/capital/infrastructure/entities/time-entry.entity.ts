import { ChainRecord } from '@coopenomics/extension-kit/sync';

/**
 * Сущность для хранения записей времени работы над задачами
 * Используется для автоматического расчета и распределения времени между коммитами
 */
export class TimeEntryEntity extends ChainRecord {
  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  contributor_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  issue_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  project_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  coopname!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  date!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  hours!: number;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  commit_hash?: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  is_committed!: boolean;

  entry_type?: string;

  estimate_snapshot?: number;
}
