import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для документа заявления о взносе результатов
 * Расширяет базовый интерфейс подписанного документа специфическими полями
 */
export interface ResultContributionStatementDocumentDomainInterface extends ISignedDocument {
  meta: ISignedDocument['meta'] & {
    project_name: string;
    component_name: string;
    result_hash: string;
    percent_of_result: string;
    total_amount: string;
  };
}