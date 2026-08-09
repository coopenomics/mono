/** Событие: расширение снято с запуска (terminate / uninstall / выключение). Слушатели — инфраструктура расширений. */
export const EXTENSION_APP_TERMINATE_EVENT = 'extension.app.terminate' as const;

export interface ExtensionAppTerminatePayload {
  appName: string;
}
