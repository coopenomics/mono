/**
 * Удаление расширения без стирания записи (решение владельца 24.11.2026).
 *
 * В `extensions.config` кроме настроек председателя лежат отметки онбординга
 * (решения совета о положении ЦПП и их хэши), учёт собраний и служебные даты.
 * «Удалить» раньше стирало строку вместе с ними: после повторной установки
 * совет проходил те же решения заново, а доустановка по умолчанию при старте
 * сервера возвращала удалённое расширение с пустыми настройками.
 */
const chainConfig = { is_mainnet: false };

// Реестр расширений тянет модули, читающие конфиг на верхнем уровне: подменяем
// только сеть, остальное берём из настоящего конфига (см. extension-install-gate).
jest.mock('~/config/config', () => {
  const actual = jest.requireActual('~/config/config').default;
  return {
    __esModule: true,
    default: {
      ...actual,
      get blockchain() {
        return { ...actual.blockchain, ...chainConfig };
      },
    },
  };
});

import { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { ExtensionKyselyRepository } from '~/infrastructure/database/kysely/repositories/extension.kysely-repository';
import { ExtensionInteractor } from '~/application/appstore/interactors/extension.interactor';
import { ExtensionDomainListingService } from '~/domain/extension/services/extension-listing-domain.service';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';

const row = (overrides: Record<string, unknown> = {}) => ({
  name: 'capital',
  enabled: false,
  config: { onboarding_blagorost_provision_done: true, voting_period_in_days: 3 },
  created_at: new Date('2026-11-01T00:00:00Z'),
  updated_at: new Date('2026-11-24T00:00:00Z'),
  schema_version: 4,
  uninstalled_at: new Date('2026-11-24T00:00:00Z'),
  ...overrides,
});

function repository(results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { repo: new ExtensionKyselyRepository(db as never), queries };
}

describe('ext.soft.happy.01: удаление ставит отметку и выключает, запись с настройками остаётся', () => {
  it('deleteByName — UPDATE с uninstalled_at и enabled = false, не DELETE', async () => {
    const { repo, queries } = repository([{ rows: [row()] }]);

    await expect(repo.deleteByName('capital')).resolves.toBe(true);

    expect(queries[0].sql).not.toMatch(/^delete/i);
    expect(queries[0].sql).toContain('update "extensions" set "uninstalled_at" = now(), "enabled" = $1');
    expect(queries[0].sql).toMatch(/where "name" = \$\d and "uninstalled_at" is null/);
    expect(queries[0].parameters).toEqual(expect.arrayContaining([false, 'capital']));
  });

  it('повторное удаление уже удалённого ничего не меняет и отвечает false', async () => {
    const { repo } = repository([{ rows: [] }]);
    await expect(repo.deleteByName('capital')).resolves.toBe(false);
  });
});

describe('ext.soft.side.01: для чтений и правок через каркас удалённой записи нет', () => {
  it('findByName, find, update и patchConfig ищут только установленные', async () => {
    const { repo, queries } = repository([{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);

    await expect(repo.findByName('capital')).resolves.toBeNull();
    await expect(repo.find()).resolves.toEqual([]);
    await expect(repo.update({ name: 'capital', enabled: true })).rejects.toThrow();
    await expect(repo.patchConfig('capital', { voting_period_in_days: 5 } as never)).rejects.toThrow();

    for (const q of queries) expect(q.sql).toContain('"uninstalled_at" is null');
  });

  it('findUninstalledByName отдаёт удалённую запись с её config', async () => {
    const { repo, queries } = repository([{ rows: [row()] }]);

    const saved = await repo.findUninstalledByName('capital');

    expect(queries[0].sql).toContain('"uninstalled_at" is not null');
    expect(saved?.config).toMatchObject({ onboarding_blagorost_provision_done: true });
  });
});

describe('ext.soft.happy.02: повторная установка продолжает с сохранённого config', () => {
  it('create при конфликте снимает отметку и сливает config: сохранённый || пришедший', async () => {
    const { repo, queries } = repository([{ rows: [row({ uninstalled_at: null, enabled: true })] }]);

    await repo.create({ name: 'capital', enabled: true, config: { voting_period_in_days: 7 } as never });

    const sql = queries[0].sql;
    expect(sql).toContain('insert into "extensions"');
    expect(sql).toContain('on conflict ("name") do update set');
    expect(sql).toContain('"uninstalled_at" = $');
    expect(sql).toContain(`COALESCE("extensions"."config", '{}'::jsonb) || excluded.config`);
    // версию схемы при восстановлении не трогаем: штатные миграции настроек
    // доводят сохранённый config до текущей при запуске расширения
    expect(sql.split('do update set')[1]).not.toContain('"schema_version"');
    expect(queries[0].parameters).toContain(null);
  });
});

describe('ext.soft.side.02: доустановка по умолчанию не возвращает удалённое председателем', () => {
  function interactor(installed: string[], uninstalled: string[]) {
    const installApp = jest.fn(async (app: { name: string }) => app);
    const domain = {
      getDefaultApps: () => [{ name: 'capital' }, { name: 'powerup' }, { name: 'chairman' }],
      getAppByName: async (name: string) => (installed.includes(name) ? ({ name } as never) : null),
      getUninstalledAppByName: async (name: string) => (uninstalled.includes(name) ? ({ name } as never) : null),
      installApp,
    };
    const logger = { setContext: jest.fn(), error: jest.fn() };
    return { sut: new ExtensionInteractor(domain as never, {} as never, logger as never), installApp };
  }

  it('ставится только то, чего нет ни установленным, ни удалённым', async () => {
    const { sut, installApp } = interactor(['chairman'], ['capital']);

    await sut.installDefaultApps();

    expect(installApp).toHaveBeenCalledTimes(1);
    expect(installApp).toHaveBeenCalledWith({ name: 'powerup' });
  });
});

describe('ext.soft.happy.03: шаг установки показывает прежние настройки удалённого расширения', () => {
  it('каталог отдаёт удалённое неустановленным, но с сохранённым config', async () => {
    const saved = new ExtensionDomainEntity('capital', false, { voting_period_in_days: 3 } as never, new Date(), new Date(), 4);
    const domain = {
      getAppByName: async () => null,
      getUninstalledAppByName: async () => saved,
    };
    const service = new ExtensionDomainListingService(domain as never);

    const dto = await service.getCombinedApp('capital');

    expect(dto).toMatchObject({ name: 'capital', is_installed: false, enabled: false });
    expect(dto?.config).toMatchObject({ voting_period_in_days: 3 });
  });

  it('никогда не устанавливавшееся — пустой config, как прежде', async () => {
    const domain = { getAppByName: async () => null, getUninstalledAppByName: async () => null };
    const service = new ExtensionDomainListingService(domain as never);

    const dto = await service.getCombinedApp('capital');

    expect(dto).toMatchObject({ is_installed: false });
    expect(dto?.config).toEqual({});
  });
});
