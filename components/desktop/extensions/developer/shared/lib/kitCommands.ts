// Команды публичного набора издателя @coopenomics/app-kit (487-37): одна
// сборка строк для инструкции «Выпуск из терминала» и панели пакета.

/** Вызов набора: пакет из npm, установки не требует. */
export const KIT = 'npx @coopenomics/app-kit';

/** Имя приложения — часть пакета после пространства кооператива. */
export function appNameOf(packageId: string): string {
  return packageId.split('/')[1] ?? packageId;
}

/** Каркас приложения; адрес каталога записывается в манифест приложения. */
export function kitCreateCommand(packageId: string, title: string, catalogUrl: string | null): string {
  const catalog = catalogUrl ? ` --catalog ${catalogUrl}` : '';
  return `${KIT} create ${packageId} "${title}"${catalog}`;
}

/** Выпуск из папки приложения; `brief` — текст для модератора каталога. */
export function kitPublishCommand(brief?: string): string {
  return brief ? `RELEASE_BRIEF="${brief}" ${KIT} publish` : `${KIT} publish`;
}
