/**
 * `hooks/` — контракты, которые предоставляет РАСШИРЕНИЕ, а вызывает ядро (callback API).
 *
 * Секция зарезервирована и намеренно пуста в MVP (ADR-05). Кандидаты на будущее:
 * `IPluginLifecycleHook` (`onBeforeUninstall`), `ICustomMetricHook`, `IHealthCheckHook`.
 * Пока секции нет содержимого, обходной путь для плагина — side-channel (ADR-4 OQ-008).
 */
export {};
