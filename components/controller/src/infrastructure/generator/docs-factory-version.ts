import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DOCS_FACTORY_VERSION } from '@coopenomics/docs-factory';

const PACKAGE = '@coopenomics/docs-factory';

/** Версия фабрики, объявленная в package.json контроллера; ищется вверх от этого файла. */
function declaredVersion(): string | undefined {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; dependencies?: Record<string, string> };
      if (pkg.name === '@coopenomics/controller') return pkg.dependencies?.[PACKAGE];
    }
    dir = dirname(dir);
  }
  return undefined;
}

/**
 * Установленная фабрика документов обязана совпасть с объявленной (решение 15
 * PRD компонента 71). Версию в package.json поднимает робот выпуска фабрики;
 * забытый после этого `pnpm install` оставил бы узел на прежней фабрике, и
 * расхождение всплыло бы странным документом. Поэтому — отказ при старте с
 * понятным текстом. Подключённый локальный чекаут (`pnpm factory:link`)
 * проверку проходит: объявленная версия у него — ссылка, а не номер.
 */
export function assertDocsFactoryVersion(): void {
  const declared = declaredVersion();
  if (!declared || !/^\d+\.\d+\.\d+/.test(declared)) return;
  if (declared !== DOCS_FACTORY_VERSION) {
    // i18n-ignore: отказ при старте читает оператор узла в журнале
    throw new Error(`Фабрика документов: установлена ${DOCS_FACTORY_VERSION}, в package.json контроллера — ${declared}. Выполните pnpm install.`);
  }
}
