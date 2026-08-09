export type { CertificateRenewalHandle, CertificateStatus, CoopChainLink, CoopIdSchemaPolicy, ParticipantCertificateClaims, ScheduleCertificateRenewalOptions, SchemaPolicyCache, SchemaPolicyCacheOptions, VerificationTypeClaim } from './certificate'
export {
  CERTIFICATE_EXPIRING_WINDOW_MS,
  CERTIFICATE_RENEWAL_LEAD_MS,
  certificateStatus,
  compareSchemaVersions,
  computeRenewalDelayMs,
  createSchemaPolicyCache,
  decodeParticipantCertificate,
  isSchemaVersionSupported,
  scheduleCertificateRenewal,
  SCHEMA_POLICY_CACHE_TTL_MS,
  SCHEMA_POLICY_WELL_KNOWN_PATH,
  VERIFICATION_TYPE_LABELS,
  verificationTypeLabel,
} from './certificate'

export type { KeyValidityWindow, VerifyDocumentParams, VerifyDocumentReason, VerifyDocumentResult, VerifyOfflineOptions, VerifyOfflineReason, VerifyOfflineResult } from './chain'

export { readCertPublicKey, verifyDocumentOffline, verifyOffline } from './chain'
/**
 * @coopenomics/auth — SDK аутентификации CoopID.
 *
 * Публичная поверхность зафиксирована скелетом (Story 1.2): все методы
 * типизированы и бросают AuthV2Error(not_implemented) до своей реализации.
 */
export { COOPOS_PUBLIC_NODES } from './config/coopos-public-nodes'

export { TRUST_ANCHOR_ANO_CERT_PUBKEY } from './config/trust-anchor'
export { AUTH_V2_ERROR_VIEWS, AuthV2Error, AuthV2ErrorCode, describeAuthV2Error } from './errors'
export type { AuthV2ErrorAction, AuthV2ErrorView } from './errors'

export type { ExportFullQROptions } from './export'
export { exportFullQR } from './export'
export type { MigrateParams } from './migration'

export { canonicalMigrationMessage, migrate } from './migration'
export type { FlowExecutorParams, HandshakeResult, LoginParams, LoginResult, LogoutParams, SessionTokens } from './oidc'

export { authenticateWithFlowExecutor, configureCoopId, configureOidc, configureTokenStorage, currentTokens, DEFAULT_AUTHENTICATION_FLOW, getAccessToken, getParticipantCertificate, login, loginWithMagicLink, logout, performTimestampHandshake, recover, restoreSession, warmUpAuthentik } from './oidc'
export type { SignDocumentParams, TimestampSignature } from './signing'

export { canonicalTimestampMessage, signChainDigest, signDocument, signTimestamp } from './signing'
export type { EncryptedVaultBlob, VaultSubject } from './vault'

export { ARGON2ID_PARAMS, decryptPrivateKey, deriveKey, encryptPrivateKey } from './vault'
export type { StorageAdapter } from './wallet'

export { clearLocalVault, clearPinCache, DEFAULT_PIN, fetchVaultBlob, getWallet, hasPinCache, isWalletUnlocked, loadLocalVault, lockWallet, persistPinCache, rotateKey, saveLocalVault, saveToVault, storeVaultBlob, unlockWallet, unlockWithPin, Wallet } from './wallet'
