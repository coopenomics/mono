/**
 * Порты согласия на force-recovery (CoopID, Story 6.9). Председатель не может сбросить
 * доступ пайщика без (а) согласия самого пайщика по magic-link или (б) решения общего
 * собрания (on-chain). Этот порт обслуживает канал (а): одноразовый consent-токен,
 * который пайщик подтверждает кликом, и краткоживущая отметка «согласие выдано».
 * Хранилище — Redis (`ioredis` только в infrastructure).
 */

/** Кому и от кого запрошено согласие на force-recovery. */
export interface ForceRecoveryConsentRequest {
  targetId: string;
  initiatorId: string;
}

export const FORCE_RECOVERY_CONSENT_STORE = Symbol('ForceRecoveryConsentStore');

export interface IForceRecoveryConsentStore {
  /** Выдать одноразовый consent-токен (TTL сек), привязанный к (target, initiator). */
  issueRequest(token: string, request: ForceRecoveryConsentRequest, ttlSec: number): Promise<void>;
  /** Прочитать-и-удалить токен (single-use); null если нет/истёк/потреблён. */
  consumeRequest(token: string): Promise<ForceRecoveryConsentRequest | null>;
  /** Отметить, что пайщик согласие дал (краткий TTL — председатель должен успеть авторизовать). */
  markGranted(targetId: string, initiatorId: string, ttlSec: number): Promise<void>;
  /** Есть ли действующая отметка согласия для пары (target, initiator). */
  isGranted(targetId: string, initiatorId: string): Promise<boolean>;
}

export const FORCE_RECOVERY_CONSENT_NOTIFIER = Symbol('ForceRecoveryConsentNotifier');

/** Канал «пайщику нужно подтвердить force-recovery» (доставка письма — downstream). */
export const FORCE_RECOVERY_CONSENT_CHANNEL = 'coopid:force-recovery:consent-requested';

export interface IForceRecoveryConsentNotifier {
  /** Известить пайщика о запросе согласия (с токеном для magic-link). */
  notifyConsentRequested(request: ForceRecoveryConsentRequest & { token: string }): Promise<void>;
}
