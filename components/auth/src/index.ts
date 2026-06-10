/**
 * @coopenomics/auth — SDK аутентификации CoopID.
 *
 * Публичная поверхность зафиксирована скелетом (Story 1.2): все методы
 * типизированы и бросают AuthV2Error(not_implemented) до своей реализации.
 */
export { COOPOS_PUBLIC_NODES } from './config/coopos-public-nodes'
export { TRUST_ANCHOR_ANO_CERT_JWK } from './config/trust-anchor'

export { AuthV2Error, AuthV2ErrorCode } from './errors'

export type { LoginParams, LoginResult } from './oidc'
export { getAccessToken, getParticipantCertificate, login, loginWithMagicLink, logout, recover } from './oidc'

export type { EncryptedVaultBlob } from './vault'

export type { Wallet } from './wallet'
export { getWallet, rotateKey } from './wallet'

export type { SignedDocument, TimestampSignature } from './signing'
export { signDocument, signTimestamp } from './signing'

export type { VerifyOfflineResult } from './chain'
export { verifyOffline } from './chain'

export { exportToQR } from './export'
