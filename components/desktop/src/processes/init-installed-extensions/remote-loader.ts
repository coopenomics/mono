// Epic 9 stories 9.4 (skeleton) + 9.4.b (real fetch+eval).
//
// На boot'е desktop'а, после регистрации bundle-extensions, идём в coopback
// за списком пакетов с активной подпиской у текущего кооператива и пробуем
// dynamic-eval'ом распаковать install.js из каждого пакета, чтобы получить
// `IWorkspaceConfig[]` и добавить роуты в router.
//
// MVP (9.4.b)
//   - Список remote-пакетов читаем из публичного каталога apps-catalog
//     (Queries.Extensions.AppsCatalogRemotePackages) — это все пакеты,
//     для пилота demo-app self-sub bypass превращает «всех» в «всё что
//     должно быть установлено у кооператива-разработчика».
//   - На каждый — REST `GET /v1/apps-catalog/install/:scope/:name` за CJS
//     install.js (controller-proxy через ca-admin). HTTP JWT desktop'а.
//   - sha256 пока не проверяем (release-таблица ещё не реализована;
//     V2 9.4.c добавит manifest+sha256+release-row).
//   - eval через `new Function('module','exports','require', code)` —
//     контракт `module.exports = { install: () => Promise<IWorkspaceConfig[]> }`.
//   - Try/catch per item: падение одного пакета не валит остальные.
//
// Изоляция: V1 НЕ выполняет код пакетов в sandbox — это будет в story 11.x.
// На MVP исполнение происходит в том же window/contexte что и desktop SPA.

import axios from 'axios';
import type { Router } from 'vue-router';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { env } from 'src/shared/config';
import { useGlobalStore } from 'src/shared/store';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';

export interface RemoteExtensionDescriptor {
  packageId: string;
  scope: string;
  name: string;
  publisher: string;
  version: string | null;
  title: string;
  description: string;
}

interface RemoteInstallModule {
  install?: () => Promise<IWorkspaceConfig[]> | IWorkspaceConfig[];
  default?: () => Promise<IWorkspaceConfig[]> | IWorkspaceConfig[];
}

/**
 * Распилить `@scope/name` на компоненты. `null` если формат не подходит —
 * безымянные / без scope пакеты на MVP не поддерживаем.
 */
function splitPackageId(
  packageId: string,
): { scope: string; name: string } | null {
  const match = /^@([a-z0-9][a-z0-9-]{0,63})\/([a-z0-9][a-z0-9-]{0,63})$/.exec(
    packageId,
  );
  if (!match) return null;
  return { scope: match[1], name: match[2] };
}

/**
 * Запросить у coopback список remote-пакетов через apps-catalog-proxy
 * (Story 9.5.b). На MVP отдаются ВСЕ опубликованные пакеты — фильтр
 * «подписаны / не подписаны» появится в 9.6.c вместе с реальной
 * subscription read-port.
 */
export async function fetchInstalledRemotePackages(
  coopname: string,
): Promise<RemoteExtensionDescriptor[]> {
  // coopname зарезервирован для 9.6.c (фильтр по подпискам tenant'а);
  // сейчас прокси отдаёт публичный каталог без фильтра.
  void coopname;
  try {
    const out = await client.Query(
      Queries.Extensions.AppsCatalogRemotePackages.query,
      { variables: { page: 1, pageSize: 50 } },
    );
    const list =
      out[Queries.Extensions.AppsCatalogRemotePackages.name] ?? [];
    const result: RemoteExtensionDescriptor[] = [];
    for (const pkg of list) {
      const coords = splitPackageId(pkg.packageId);
      if (!coords) {
        console.warn(
          `[remote-loader] пропуск пакета с неподдерживаемым packageId: ${pkg.packageId}`,
        );
        continue;
      }
      result.push({
        packageId: pkg.packageId,
        scope: coords.scope,
        name: coords.name,
        publisher: pkg.publisher,
        version: pkg.lastActiveVersion ?? null,
        title: pkg.title,
        description: pkg.description,
      });
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[remote-loader] не удалось получить каталог:', msg);
    return [];
  }
}

/**
 * Скачать install.js пакета и eval'нуть его в plain CJS-обёртке.
 * Возвращает массив workspace'ов, который install() пакета вернул.
 *
 * На MVP sha256 не валидируется; manifest / release-row появятся в 9.4.c.
 */
export async function loadRemoteExtension(
  desc: RemoteExtensionDescriptor,
): Promise<IWorkspaceConfig[]> {
  const { tokens } = useGlobalStore();
  const url = `${env.BACKEND_URL}/v1/apps-catalog/install/${encodeURIComponent(
    desc.scope,
  )}/${encodeURIComponent(desc.name)}`;
  const response = await axios.get<string>(url, {
    responseType: 'text',
    transformResponse: (data: unknown) =>
      typeof data === 'string' ? data : String(data),
    headers: tokens?.access?.token
      ? { Authorization: `Bearer ${tokens.access.token}` }
      : {},
  });
  const code: string = response.data;
  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('empty install.js response');
  }

  const module: { exports: RemoteInstallModule } = { exports: {} };
  const requireNotSupported = (id: string) => {
    throw new Error(
      `require("${id}") не поддерживается в remote-loader; пакет ${desc.packageId} должен быть CJS без внешних зависимостей`,
    );
  };

  const factory = new Function(
    'module',
    'exports',
    'require',
    `"use strict";\n${code}`,
  ) as (
    module: { exports: RemoteInstallModule },
    exports: RemoteInstallModule,
    require: (id: string) => unknown,
  ) => void;
  factory(module, module.exports, requireNotSupported);

  const installFn = module.exports.install ?? module.exports.default;
  if (typeof installFn !== 'function') {
    throw new Error(
      `пакет ${desc.packageId} не экспортирует install() — ${typeof installFn}`,
    );
  }
  const cfgs = await installFn();
  if (!Array.isArray(cfgs)) {
    throw new Error(
      `install() пакета ${desc.packageId} вернул не массив: ${typeof cfgs}`,
    );
  }
  return cfgs;
}

/**
 * Один pass remote-loader'а: получить список → загрузить каждый → отдать
 * слитый массив workspace'ов вызывателю, который сам впишет их в store/router.
 *
 * Падение одного пакета не должно валить остальные (try/catch per item).
 */
export async function installRemoteExtensions(
  coopname: string,
  router: Router,
): Promise<IWorkspaceConfig[]> {
  // router зарезервирован для будущей story 11.x (sandbox-аутоинъекция
  // роутов из install.js без возврата в caller); сейчас caller сам
  // вписывает routes в `router.addRoute('base', ...)`.
  void router;
  const descriptors = await fetchInstalledRemotePackages(coopname);
  const all: IWorkspaceConfig[] = [];
  for (const desc of descriptors) {
    try {
      const cfgs = await loadRemoteExtension(desc);
      all.push(...cfgs);
      console.log(
        `[remote-loader] установлен ${desc.packageId}${desc.version ? '@' + desc.version : ''} (${cfgs.length} workspace[ов])`,
      );
    } catch (err) {
      console.error(
        `[remote-loader] не удалось установить ${desc.packageId}:`,
        err,
      );
    }
  }
  return all;
}
