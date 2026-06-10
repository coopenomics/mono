export type { CertificateStatus, CoopChainLink, ParticipantCertificateClaims } from './certificate'
export {
  CERTIFICATE_EXPIRING_WINDOW_MS,
  certificateStatus,
  decodeParticipantCertificate,
  VERIFICATION_TYPE_LABELS,
  verificationTypeLabel,
} from './certificate'

export type { VerifyOfflineResult } from './chain'

export { readCertPublicKey, verifyOffline } from './chain'
/**
 * @coopenomics/auth — SDK аутентификации CoopID.
 *
 * Публичная поверхность зафиксирована скелетом (Story 1.2): все методы
 * типизированы и бросают AuthV2Error(not_implemented) до своей реализации.
 */
export { COOPOS_PUBLIC_NODES } from './config/coopos-public-nodes'

export { TRUST_ANCHOR_ANO_CERT_JWK } from './config/trust-anchor'
export { AuthV2Error, AuthV2ErrorCode } from './errors'

export { exportToQR } from './export'
export type { LoginParams, LoginResult, LogoutParams } from './oidc'

export { getAccessToken, getParticipantCertificate, login, loginWithMagicLink, logout, recover } from './oidc'
export type { SignedDocument, TimestampSignature } from './signing'

export { canonicalTimestampMessage, signDocument, signTimestamp } from './signing'
export type { EncryptedVaultBlob, VaultSubject } from './vault'

export { ARGON2ID_PARAMS, decryptPrivateKey, deriveKey, encryptPrivateKey } from './vault'
export type { StorageAdapter } from './wallet'

export { clearPinProtected, fetchVaultBlob, getWallet, isWalletUnlocked, lockWallet, rotateKey, unlockWallet, unlockWithPin, Wallet } from './wallet'
