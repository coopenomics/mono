/**
 * Права столов разработчика и администратора каталога (487-37): право
 * оператора каталога ядро выдаёт только на узле оператора.
 */
import { DeveloperRights, developerRightsTable } from '~/extensions/apps-catalog-proxy/application/access/developer-rights';

function build(hasOperatorAccess: boolean) {
  const registry = { register: jest.fn() };
  const catalog = { hasOperatorAccess };
  return new DeveloperRights(registry as never, catalog as never);
}

const caller = (role: string, status = 'active') => ({ role, status }) as never;

describe('права столов разработчика и администратора', () => {
  it('happy: председатель узла оператора каталога — администратор, оператор и издатель', async () => {
    expect(await build(true).roles(caller('chairman'))).toEqual(['chairman', 'operator', 'publisher']);
  });

  it('side: председатель узла кооператива без ключа оператора — администратор и издатель, права оператора нет', async () => {
    expect(await build(false).roles(caller('chairman'))).toEqual(['chairman', 'publisher']);
  });

  it('break: принятый пайщик узла оператора — только издатель: право оператора требует председателя', async () => {
    expect(await build(true).roles(caller('user'))).toEqual(['publisher']);
  });

  it('break: не принятый пайщик прав не получает', async () => {
    expect(await build(true).roles(caller('user', 'created'))).toEqual([]);
  });

  it('side: модерация и запись пакета стоят под правом оператора, пакеты и издатели — под правом администратора', () => {
    expect(developerRightsTable.operator).toEqual([{ when: [], rights: { CatalogOperator: ['manage'] } }]);
    expect(developerRightsTable.chairman).toEqual([{ when: [], rights: { Developer: ['manage'] } }]);
    expect(developerRightsTable.publisher).toEqual([{ when: [], rights: { Publisher: ['manage'] } }]);
  });
});
