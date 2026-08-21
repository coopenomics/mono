/**
 * Сужающие политики витрины вступления (innercoop IRegistrationOfferFilterHook).
 */
import { ExtensionOfferFilterRegistry } from '~/domain/registration/services/extension-offer-filter.registry';

const logger = { setContext: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

const programs = [
  { key: 'CAPITALIZATION', extension_name: 'capital' },
  { key: 'GENERATION', extension_name: 'capital' },
  { key: 'EDUCATION', extension_name: 'edubridge' },
  { key: 'MARKETPLACE', extension_name: 'market' },
] as any[];

const agreements = [
  { id: 'blagorost_offer', extension_name: 'capital' },
  { id: 'edu_parent_offer', extension_name: 'edubridge' },
] as any[];

function filter(extensionName: string, keepPrograms: string[], keepAgreements: string[] = []) {
  return {
    extensionName,
    filterPrograms: jest.fn(() => keepPrograms),
    filterAgreements: jest.fn(() => keepAgreements),
  };
}

describe('ExtensionOfferFilterRegistry', () => {
  it('без фильтров ничего не меняет', () => {
    const reg = new ExtensionOfferFilterRegistry(logger);
    expect(reg.narrowPrograms(programs, {})).toEqual(programs);
  });

  it('скрывает чужие программы, свои оставляет и не даёт добавить лишнее', () => {
    const reg = new ExtensionOfferFilterRegistry(logger);
    reg.register(filter('edubridge', ['MARKETPLACE', 'UNKNOWN']));
    expect(reg.narrowPrograms(programs, {}).map((p) => p.key)).toEqual(['EDUCATION', 'MARKETPLACE']);
    const f = reg['filters'].get('edubridge')!;
    // собственная программа фильтру не предлагается
    const offered = (f.filterPrograms as jest.Mock).mock.calls[0][0].map((p: any) => p.key);
    expect(offered).not.toContain('EDUCATION');
  });

  it('пересечение не зависит от порядка', () => {
    const a = new ExtensionOfferFilterRegistry(logger);
    a.register(filter('x', ['CAPITALIZATION', 'EDUCATION']));
    a.register(filter('y', ['EDUCATION', 'MARKETPLACE']));
    const b = new ExtensionOfferFilterRegistry(logger);
    b.register(filter('y', ['EDUCATION', 'MARKETPLACE']));
    b.register(filter('x', ['CAPITALIZATION', 'EDUCATION']));
    expect(a.narrowPrograms(programs, {}).map((p) => p.key)).toEqual(b.narrowPrograms(programs, {}).map((p) => p.key));
    expect(a.narrowPrograms(programs, {}).map((p) => p.key)).toEqual(['EDUCATION']);
  });

  it('сбой фильтра — список остаётся как есть', () => {
    const reg = new ExtensionOfferFilterRegistry(logger);
    reg.register({ extensionName: 'broken', filterPrograms: () => { throw new Error('boom'); }, filterAgreements: () => [] });
    expect(reg.narrowPrograms(programs, {})).toEqual(programs);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('оферты сужаются той же дисциплиной', () => {
    const reg = new ExtensionOfferFilterRegistry(logger);
    reg.register(filter('edubridge', [], []));
    expect(reg.narrowAgreements(agreements, {}).map((a) => a.id)).toEqual(['edu_parent_offer']);
  });
});
