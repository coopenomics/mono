import type { GeneratedDocumentDomainInterface } from '@coopenomics/extension-kit';
import type { ExtendedBlockchainActionDomainInterface } from './extended-blockchain-action-domain.interface';

export interface ActDetailDomainInterface {
  action?: ExtendedBlockchainActionDomainInterface;
  document?: GeneratedDocumentDomainInterface;
}
