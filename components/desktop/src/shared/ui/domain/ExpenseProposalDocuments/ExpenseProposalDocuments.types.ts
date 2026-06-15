import type { IDocumentAggregate } from 'src/entities/Document/model';

export interface ExpenseProposalDocumentsProps {
  /** Заявление пайщика о расходе (служебная записка, 2010). */
  statement?: IDocumentAggregate | null;
  /** Решение совета о расходе (протокол, 2011). */
  decision?: IDocumentAggregate | null;
}
