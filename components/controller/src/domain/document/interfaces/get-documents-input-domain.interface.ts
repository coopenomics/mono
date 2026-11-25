import { DocumentAction } from '../enums/document-action.enum';
import type { DocumentsView } from '../enums/documents-view.enum';

export interface GetDocumentsInputDomainInterface {
  type?: 'newsubmitted' | 'newresolved';
  query: Record<string, unknown>;
  page?: number;
  limit?: number;
  after_block?: number;
  before_block?: number;
  /**
   * Массив типов действий для фильтрации по полю data.action.
   * Используется оператор $in для выборки документов с указанными действиями.
   */
  actions?: DocumentAction[];
  /** Вид выдачи: пакеты (по умолчанию) либо каждый документ отдельно. */
  view?: DocumentsView;
  signed_from?: Date;
  signed_to?: Date;
  registry_ids?: number[];
  search?: string;
}
