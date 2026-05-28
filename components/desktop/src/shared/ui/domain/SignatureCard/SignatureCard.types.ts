export type SignatureStatus = 'pending' | 'signed' | 'rejected';

export interface SignatureSigner {
  fullName: string;
  accountName?: string;
  avatar?: string;
}

export interface Signature {
  status: SignatureStatus;
  signer: SignatureSigner;
  signedAt?: string;
  hash?: string;
  rejectionReason?: string;
}

export interface SignatureCardProps {
  signature: Signature;
}
