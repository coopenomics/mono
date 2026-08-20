export type { CertificateRenewalHandle, CertificateStatus, ChainVerificationRecord, TrustChainLink, CoopIdSchemaPolicy, ParticipantCertificateClaims, ScheduleCertificateRenewalOptions, SchemaPolicyCache, SchemaPolicyCacheOptions, VerificationTypeClaim } from './certificate'
export {
  CERTIFICATE_EXPIRING_WINDOW_MS,
  CERTIFICATE_RENEWAL_LEAD_MS,
  certificateStatus,
  compareSchemaVersions,
  computeRenewalDelayMs,
  createSchemaPolicyCache,
  decodeParticipantCertificate,
  decodeTrustChain,
  isSchemaVersionSupported,
  scheduleCertificateRenewal,
  SCHEMA_POLICY_CACHE_TTL_MS,
  SCHEMA_POLICY_WELL_KNOWN_PATH,
  VERIFICATION_TYPE_LABELS,
  VERIFICATION_TYPE_SHORT_LABELS,
  verificationTypeLabel,
  verificationTypeShortLabel,
  CHAIN_PROCEDURE_TO_TYPE,
  deriveVerificationTypes,
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
export type { MigrateParams, MigrateResult } from './migration'

export { canonicalMigrationMessage, migrate } from './migration'
export { isPasswordPolicyOk, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT, passwordPolicyErrors } from './password-policy'
export type { ConfirmLoginFactorParams, ConfirmLoginFactorResult, FlowExecutorParams, HandshakeResult, LoginFactorKind, LoginParams, LoginResult, LogoutParams, SecondFactorChallenge, SessionTokens } from './oidc'

export { authenticateWithFlowExecutor, clearSession, configureCoopId, configureOidc, configureTokenStorage, confirmLoginFactor, currentTokens, DEFAULT_AUTHENTICATION_FLOW, getAccessToken, getParticipantCertificate, login, loginWithMagicLink, logout, performTimestampHandshake, recover, resendLoginEmailCode, restoreSession, warmUpAuthentik } from './oidc'
export type { SignDocumentParams, TimestampSignature } from './signing'

export { canonicalTimestampMessage, signChainDigest, signDocument, signTimestamp } from './signing'
export type { EncryptedVaultBlob, VaultSubject } from './vault'

export { ARGON2ID_PARAMS, decryptPrivateKey, deriveKey, encryptPrivateKey } from './vault'
export type { StorageAdapter } from './wallet'

export { clearLocalVault, clearPinCache, DEFAULT_PIN, exportUnlockedKeyForDocumentSigning, fetchVaultBlob, getWallet, hasPinCache, isWalletUnlocked, loadLocalVault, lockWallet, persistPinCache, rotateKey, saveLocalVault, saveToVault, storeVaultBlob, unlockWallet, unlockWithPin, Wallet } from './wallet'
