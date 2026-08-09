import type { ISignedDocumentDomainInterface, ISignatureInfoDomainInterface } from '@coopenomics/innercoop';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

export interface SignatureInfoDomainInterface extends ISignatureInfoDomainInterface {
  is_valid?: boolean;
  signer_certificate?: UserCertificateDomainInterface | null;
}

export interface ExtendedSignedDocumentDomainInterface extends ISignedDocumentDomainInterface {
  signatures: SignatureInfoDomainInterface[];
}
