import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';
import type { ActDetailDomainInterface } from './act-detail-domain.interface';
import type { DecisionDetailDomainInterface } from './decision-detail-domain.interface';
import type { StatementDetailDomainInterface } from './statement-detail-domain.interface';

export interface DocumentPackageDomainInterface {
  statement: StatementDetailDomainInterface | null;
  decision: DecisionDetailDomainInterface | null;
  acts: ActDetailDomainInterface[];
  links: GeneratedDocumentDomainInterface[];
}
