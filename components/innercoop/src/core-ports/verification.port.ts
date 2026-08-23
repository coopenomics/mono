/**
 * Верификация личности пайщика — уровни подтверждения, которыми ядро
 * отвечает на вопрос расширения «можно ли этому пайщику доверить действие».
 *
 * Уровни — независимые факты-подтверждения (не иерархия): `coop_baseline` —
 * пайщик принят кооперативом, `passport_onsite` — личность сверена с паспортом
 * на кооперативном участке; набор расширяется. Какие уровни обязательны для
 * какого действия — задают правила кооператива (по коду действия), расширение
 * не хардкодит требования, а спрашивает `checkRequired`.
 */
export interface InnerVerificationEntry {
  /** Уровень верификации (например, `coop_baseline`, `passport_onsite`). */
  type: string;
  /** Момент подтверждения, ISO-8601 (UTC). */
  verified_at: string;
  /** Кто провёл верификацию (аккаунт), если подтверждение персональное. */
  attested_by?: string;
}

export interface InnerVerificationCheck {
  /** Достаточен ли уровень верификации пайщика для действия. */
  passed: boolean;
  /** Недостающие уровни (пусто, если passed). */
  missing: string[];
}

export interface IVerificationPort {
  /** Подтверждённые уровни верификации пайщика; пусто, если подтверждений нет. */
  getVerificationTypes(username: string): Promise<InnerVerificationEntry[]>;
  /**
   * Проверить пайщика против правила действия (`action_code`). Если правило
   * для действия не задано — проверка пройдена: отсутствие ограничения, а не отказ.
   */
  checkRequired(username: string, actionCode: string): Promise<InnerVerificationCheck>;
}

export const VERIFICATION_PORT = Symbol.for('Innercoop.CorePort.Verification');
