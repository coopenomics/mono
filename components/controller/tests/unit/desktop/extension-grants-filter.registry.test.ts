/**
 * Сужающие политики столов (innercoop IDesktopGrantsFilterHook): ядро
 * пересекает набор владельца со всеми чужими фильтрами. Инварианты:
 * результат ⊆ входа, порядок фильтров не важен, сбой фильтра — в пользу
 * владельца, свой стол фильтр не трогает.
 */
import { ExtensionGrantsFilterRegistry } from '~/application/desktop/extension-grants-filter.registry';

const logger = { setContext: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;
const ctx = { coopname: 'voskhod', username: 'ant', userRole: 'user', userStatus: 'active' };

function keepOnly(extensionName: string, kept: string[], target = 'capital') {
  return {
    extensionName,
    filterGrants: jest.fn(async (t: { extensionName: string; grants: readonly string[] }) =>
      t.extensionName === target ? kept : [...t.grants]
    ),
  };
}

describe('ExtensionGrantsFilterRegistry.narrow', () => {
  it('без фильтров возвращает набор владельца как есть', async () => {
    const reg = new ExtensionGrantsFilterRegistry(logger);
    await expect(reg.narrow('capital', ['A', 'B'], ctx)).resolves.toEqual(['A', 'B']);
  });

  it('оставляет только пересечение и не даёт фильтру добавить право', async () => {
    const reg = new ExtensionGrantsFilterRegistry(logger);
    reg.register(keepOnly('edubridge', ['B', 'Z']));
    await expect(reg.narrow('capital', ['A', 'B'], ctx)).resolves.toEqual(['B']);
  });

  it('результат не зависит от порядка регистрации фильтров', async () => {
    const a = new ExtensionGrantsFilterRegistry(logger);
    a.register(keepOnly('x', ['A', 'B']));
    a.register(keepOnly('y', ['B', 'C']));
    const b = new ExtensionGrantsFilterRegistry(logger);
    b.register(keepOnly('y', ['B', 'C']));
    b.register(keepOnly('x', ['A', 'B']));
    const input = ['A', 'B', 'C'];
    expect(await a.narrow('capital', input, ctx)).toEqual(await b.narrow('capital', input, ctx));
    expect(await a.narrow('capital', input, ctx)).toEqual(['B']);
  });

  it('сбой фильтра не меняет набор владельца и пишется в журнал', async () => {
    const reg = new ExtensionGrantsFilterRegistry(logger);
    reg.register({ extensionName: 'broken', filterGrants: async () => { throw new Error('boom'); } });
    reg.register(keepOnly('edubridge', ['A']));
    await expect(reg.narrow('capital', ['A', 'B'], ctx)).resolves.toEqual(['A']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('к собственному столу фильтр не применяется', async () => {
    const reg = new ExtensionGrantsFilterRegistry(logger);
    reg.register(keepOnly('capital', [], 'capital'));
    await expect(reg.narrow('capital', ['A'], ctx)).resolves.toEqual(['A']);
  });

  it('unregister снимает фильтр', async () => {
    const reg = new ExtensionGrantsFilterRegistry(logger);
    reg.register(keepOnly('edubridge', []));
    reg.unregister('edubridge');
    await expect(reg.narrow('capital', ['A'], ctx)).resolves.toEqual(['A']);
  });
});
