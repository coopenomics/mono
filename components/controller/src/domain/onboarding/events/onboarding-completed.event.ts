/**
 * Событие: расширение завершило L1-онбординг
 * (все его шаги в extension.config.* проставлены в _done = true).
 *
 * Эмиттится сервисом онбординга расширения сразу после успешного
 * `completeStep`, когда последний `_done` флаг встал. Слушатель —
 * ExtensionLifecycleDomainService — автоматически вызывает
 * `restartApp(extension_name)`, чтобы расширение перерегистрировало
 * свои оферты/программы через `initialize(config)` с актуальным
 * содержимым extension.config (раздел 4.2 req 44 проекта 13;
 * принятая архитектурная предпосылка 7.1 в плане C28-10:
 * вариант (в) — auto-restart, без ручного действия совета).
 */
export const ONBOARDING_COMPLETED_EVENT = 'onboarding.completed' as const;

export interface OnboardingCompletedPayload {
  /** Имя расширения, у которого завершился L1 (совпадает с appName в AppRegistry). */
  extension_name: string;
}
