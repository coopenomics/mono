// Epic 9 stories 9.4 (skeleton) + 9.4.b (real fetch+eval) → E12-3.
//
// На boot'е desktop'а, после регистрации bundle-extensions, идём в coopback
// за списком фронтов, реально УСТАНОВЛЕННЫХ у текущего кооператива, и
// dynamic-eval'ом распаковываем install.js каждого, чтобы получить
// `IWorkspaceConfig[]` и добавить роуты в router.
//
// E12-3 (заменяет публичный каталог как источник):
//   - Список — REST `GET /v1/apps-catalog/installed-frontends`: coopback
//     проксирует volume-кэш orchestrator'а (E12-2), где лежат только
//     пакеты с активной подпиской кооператива; sha256 install.js там
//     уже сверен с декларацией манифеста (fail-closed).
//   - На каждый — REST `GET /v1/apps-catalog/install/:scope/:name` за CJS
//     install.js. HTTP JWT desktop'а (JWT-gated доставка).
//   - Перед eval сверяем sha256 тела с `X-Install-Script-Sha256`
//     (crypto.subtle); расхождение — отказ установки пакета.
//   - eval через `new Function('module','exports','require', code)` —
//     контракт `module.exports = { install: () => Promise<IWorkspaceConfig[]> }`.
//   - Try/catch per item: падение одного пакета не валит остальные.
//
// Изоляция: V1 НЕ выполняет код пакетов в sandbox — это будет в story 11.x.
// На MVP исполнение происходит в том же window/contexte что и desktop SPA.

import axios from 'axios';
import type { Router } from 'vue-router';
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

interface InstalledFrontendMeta {
  packageId: string;
  scope: string;
  name: string;
  version: string;
  sha256: string;
  cachedAt: string;
}

/**
 * Запросить у coopback список фронтов, фактически установленных у
 * кооператива (E12-3): coopback проксирует кэш orchestrator'а, где
 * лежат только пакеты с активной подпиской. Публичный каталог как
 * источник установки мёртв — он остаётся только витриной.
 */
export async function fetchInstalledRemotePackages(
  coopname: string,
): Promise<RemoteExtensionDescriptor[]> {
  // coopname в запрос не передаётся: контур кооператива один, JWT и так
  // привязан к нему; параметр сохранён в сигнатуре для совместимости.
  void coopname;
  const { tokens } = useGlobalStore();
  // Без входа список закрыт сервером (401): опрос не идёт, пока пайщик не вошёл.
  if (!tokens?.access?.token) return [];
  try {
    const response = await axios.get<{ items: InstalledFrontendMeta[] }>(
      `${env.BACKEND_URL}/v1/apps-catalog/installed-frontends`,
      {
        headers: tokens?.access?.token
          ? { Authorization: `Bearer ${tokens.access.token}` }
          : {},
      },
    );
    const result: RemoteExtensionDescriptor[] = [];
    for (const item of response.data.items ?? []) {
      const coords = splitPackageId(item.packageId);
      if (!coords) {
        console.warn(
          `[remote-loader] пропуск пакета с неподдерживаемым packageId: ${item.packageId}`,
        );
        continue;
      }
      result.push({
        packageId: item.packageId,
        scope: coords.scope,
        name: coords.name,
        publisher: coords.scope,
        version: item.version ?? null,
        title: item.packageId,
        description: '',
      });
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      '[remote-loader] не удалось получить список установленных фронтов:',
      msg,
    );
    return [];
  }
}

/**
 * sha256 (hex) строки через WebCrypto — есть и в браузере, и в Node 20
 * (SSR). null — окружение без crypto.subtle (например http-стенд не на
 * localhost): сверку пропускаем с warn'ом, не ломая загрузку.
 */
async function computeSha256Hex(code: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Тело install.js пакета и заявленный кэшем оркестратора sha256. */
async function fetchInstallScript(
  desc: RemoteExtensionDescriptor,
): Promise<{ code: string; declaredSha: unknown }> {
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
  return {
    code,
    declaredSha: (response.headers as Record<string, unknown>)['x-install-script-sha256'],
  };
}

/**
 * E12-3: перед eval тело сверяется с `X-Install-Script-Sha256` —
 * заголовок едет из volume-кэша orchestrator'а, где sha уже проверен
 * против декларации манифеста. Расхождение = повреждение/подмена по
 * дороге → пакет не устанавливается.
 */
async function verifyInstallScript(
  code: string,
  declaredSha: unknown,
  desc: RemoteExtensionDescriptor,
): Promise<void> {
  if (typeof declaredSha !== 'string' || declaredSha.length !== 64) return;
  const actualSha = await computeSha256Hex(code);
  if (actualSha === null) {
    console.warn(
      `[remote-loader] crypto.subtle недоступен — sha256 install.js пакета ${desc.packageId} не сверен`,
    );
    return;
  }
  if (actualSha !== declaredSha) {
    throw new Error(
      // i18n-ignore: ошибка загрузки пакета для журнала разработчика — installRemoteExtensions ловит её и пишет в консоль, пайщику текст не показывается
      `sha256 install.js пакета ${desc.packageId} не совпал: ожидался ${declaredSha}, получен ${actualSha}`,
    );
  }
}

/** Исполнить install.js в CJS-обёртке и получить workspace'ы, которые вернул install() пакета. */
async function evalInstallScript(
  code: string,
  desc: RemoteExtensionDescriptor,
): Promise<IWorkspaceConfig[]> {
  const module: { exports: RemoteInstallModule } = { exports: {} };
  const requireNotSupported = (id: string) => {
    throw new Error(
      // i18n-ignore: ошибка загрузки пакета для журнала разработчика — installRemoteExtensions ловит её и пишет в консоль, пайщику текст не показывается
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
    // i18n-ignore: ошибка загрузки пакета для журнала разработчика — installRemoteExtensions ловит её и пишет в консоль, пайщику текст не показывается
      `пакет ${desc.packageId} не экспортирует install() — ${typeof installFn}`,
    );
  }
  const cfgs = await installFn();
  if (!Array.isArray(cfgs)) {
    throw new Error(
    // i18n-ignore: ошибка загрузки пакета для журнала разработчика — installRemoteExtensions ловит её и пишет в консоль, пайщику текст не показывается
      `install() пакета ${desc.packageId} вернул не массив: ${typeof cfgs}`,
    );
  }
  return cfgs;
}

/** Скачать install.js пакета, сверить sha256 и исполнить: workspace'ы, которые вернул install() пакета. */
export async function loadRemoteExtension(
  desc: RemoteExtensionDescriptor,
): Promise<IWorkspaceConfig[]> {
  const { code, declaredSha } = await fetchInstallScript(desc);
  await verifyInstallScript(code, declaredSha, desc);
  return evalInstallScript(code, desc);
}

/**
 * Память pass'а: столы уже eval'нутых в этой SPA-сессии пакетов.
 * Ключ — `packageId@version`: новая версия пакета считается новым
 * кандидатом на установку (повторный eval того же кода не делаем), а
 * столы прежних остаются в памяти — выключенное и снова включённое
 * приложение возвращается на стол без повторного eval.
 */
const installedRemoteConfigs = new Map<string, IWorkspaceConfig[]>();

function remoteKeyOf(desc: RemoteExtensionDescriptor): string {
  return `${desc.packageId}@${desc.version ?? 'unversioned'}`;
}

/** Столы одного пакета каталога вместе с его именем. */
export interface RemotePackageWorkspaces {
  packageId: string;
  configs: IWorkspaceConfig[];
}

/**
 * Один pass remote-loader'а: получить список → загрузить каждый НОВЫЙ
 * (не установленный в этой сессии) → отдать слитый массив workspace'ов
 * вызывателю, который сам впишет их в store/router.
 *
 * Pass идемпотентен — его можно вызывать периодически (auto-refresh
 * «workspace появился без F5», см. Architecture v3 шаг 18): уже
 * установленные пакеты пропускаются по `packageId@version`.
 *
 * Падение одного пакета не должно валить остальные (try/catch per item).
 */
export async function installRemoteExtensions(
  coopname: string,
  router: Router,
): Promise<RemotePackageWorkspaces[]> {
  // router зарезервирован для будущей story 11.x (sandbox-аутоинъекция
  // роутов из install.js без возврата в caller); сейчас caller сам
  // вписывает routes в `router.addRoute('base', ...)`.
  void router;
  const descriptors = await fetchInstalledRemotePackages(coopname);
  const all: RemotePackageWorkspaces[] = [];
  for (const desc of descriptors) {
    const key = remoteKeyOf(desc);
    const cached = installedRemoteConfigs.get(key);
    if (cached) {
      all.push({ packageId: desc.packageId, configs: cached });
      continue;
    }
    try {
      const cfgs = await loadRemoteExtension(desc);
      installedRemoteConfigs.set(key, cfgs);
      all.push({ packageId: desc.packageId, configs: cfgs });
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
