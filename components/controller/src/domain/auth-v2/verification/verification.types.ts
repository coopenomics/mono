/**
 * Типы верификации пайщика (CoopID, Эпик 4). MVP — единственный базовый уровень
 * `coop_baseline`: подтверждение членства самим фактом записи участника в цепи.
 * Структурная запись `VerificationTypeEntry` отдаётся в сертификат/userinfo
 * (Story 4.1 — плоский список типов, Story 4.3 — полная структура для RP).
 */

/** Тип верификации пайщика. */
export enum VerificationType {
  /** Начальный уровень: подтверждение членства — у каждого принятого пайщика. */
  CoopBaseline = 'coop_baseline',
  /** Базовый уровень: личность сверена с паспортом на кооперативном участке. */
  PassportOnsite = 'passport_onsite',
}

/** Статус подтверждения типа верификации. */
export enum VerificationStatus {
  Verified = 'verified',
}

/** Кто/что подтвердил тип верификации. */
export enum VerificationSource {
  /** Решение кооператива о приёме (on-chain запись участника). */
  CooperativeDecision = 'cooperative_decision',
  /** Личная сверка на кооперативном участке (председатель участка или доверенное лицо). */
  BranchAttestation = 'branch_attestation',
}

/**
 * Он-чейн процедура верификации (`registrator::accounts.verifications[].procedure`).
 * Каждой процедуре, дающей уровень, соответствует тип верификации —
 * связка задаётся реестром `CHAIN_PROCEDURE_TO_TYPE`.
 */
export enum VerificationProcedure {
  /** Паспорт проверен лично на кооперативном участке. */
  Passport = 'passport',
}

/** Реестр соответствия он-чейн процедур типам верификации (расширяемый). */
export const CHAIN_PROCEDURE_TO_TYPE: Readonly<Record<VerificationProcedure, VerificationType>> = {
  [VerificationProcedure.Passport]: VerificationType.PassportOnsite,
};

/** Подтверждённый тип верификации пайщика. */
export interface VerificationTypeEntry {
  type: VerificationType;
  status: VerificationStatus;
  source: VerificationSource;
  /** Момент подтверждения, ISO-8601 (UTC). Для `coop_baseline` — дата приёма в кооператив. */
  verified_at: string;
  /** Кто провёл верификацию (аккаунт), если подтверждение персональное. */
  attested_by?: string;
}

/**
 * Per-coop правило применения типов верификации (Story 4.2). Кооператив задаёт,
 * для какого действия какие типы обязательны. `action_code` — открытый идентификатор
 * действия (не enum: набор действий расширяется кооперативом произвольно, как
 * permission/scope-ключ). `required_types` — обязательные типы верификации.
 */
export interface VerificationRule {
  action_code: string;
  required_types: VerificationType[];
}
