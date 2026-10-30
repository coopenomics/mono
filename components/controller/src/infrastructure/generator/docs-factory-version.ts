import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DOCS_FACTORY_VERSION } from '@coopenomics/docs-factory';
import { DOCS_TEMPLATES_VERSION } from '@coopenomics/docs-templates';

/** Версия пакета, объявленная в package.json контроллера; ищется вверх от этого файла. */
function declaredVersion(name: string): string | undefined {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const file = join(dir, 'package.json');
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string; dependencies?: Record<string, string> };
      if (pkg.name === '@coopenomics/controller') return pkg.dependencies?.[name];
    }
    dir = dirname(dir);
  }
  return undefined;
}

/** Отказ при старте, если установлена не та версия, что объявлена. */
function assertInstalled(name: string, title: string, installed: string): void {
  const declared = declaredVersion(name);
  if (!declared || !/^\d+\.\d+\.\d+/.test(declared)) return;
  if (declared !== installed) {
    // i18n-ignore: отказ при старте читает оператор узла в журнале
    throw new Error(`${title}: установлена ${installed}, в package.json контроллера — ${declared}. Выполните pnpm install.`);
  }
}

/**
 * Установленные фабрика и шаблоны документов обязаны совпасть с объявленными
 * (решения 7 и 15 PRD компонента 71). Версии в package.json поднимает робот
 * выпуска фабрики; забытый после этого `pnpm install` оставил бы узел на
 * прежней фабрике или прежних шаблонах, и расхождение всплыло бы странным
 * документом. Поэтому — отказ при старте с понятным текстом. Подключённый
 * локальный чекаут (`pnpm factory:link`) проверку проходит: объявленная версия
 * у него — ссылка, а не номер.
 */
export function assertDocsFactoryVersion(): void {
  // i18n-ignore: название пакета в отказе при старте, его читает оператор узла в журнале
  assertInstalled('@coopenomics/docs-factory', 'Фабрика документов', DOCS_FACTORY_VERSION);
  // i18n-ignore: название пакета в отказе при старте, его читает оператор узла в журнале
  assertInstalled('@coopenomics/docs-templates', 'Шаблоны документов', DOCS_TEMPLATES_VERSION);
}
