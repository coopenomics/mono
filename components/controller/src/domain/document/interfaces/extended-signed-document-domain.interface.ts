import type { ISignedDocument, ISignatureInfo } from '@coopenomics/innercoop';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

export interface IExtendedSignatureInfo extends ISignatureInfo {
  is_valid?: boolean;
  signer_certificate?: UserCertificateDomainInterface | null;
}

export interface IExtendedSignedDocument extends ISignedDocument {
  signatures: IExtendedSignatureInfo[];
}
