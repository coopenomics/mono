import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';
import type { ExtendedBlockchainActionDomainInterface } from './extended-blockchain-action-domain.interface';

export interface DecisionDetailDomainInterface {
  action: ExtendedBlockchainActionDomainInterface;
  document: GeneratedDocumentDomainInterface;
  votes_for: ExtendedBlockchainActionDomainInterface[];
  votes_against: ExtendedBlockchainActionDomainInterface[];
}
