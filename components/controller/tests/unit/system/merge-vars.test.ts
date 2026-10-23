import { mergeVars, prepareVarsUpdate } from '~/domain/system/utils/merge-vars.util';

const base = {
  coopname: 'coop',
  name: 'РОМАШКА',
  short_abbr: 'ПК',
  website: 'https://coop.ru',
} as any;

describe('mergeVars — параметры кооператива из формы председателя', () => {
  it('поля из формы заменяют текущие', () => {
    expect(mergeVars({ ...base }, { ...base, name: 'ЛУЧ' }).name).toBe('ЛУЧ');
  });

  it('поля расширений, которых форма не знает, сохраняются', () => {
    const current = { ...base, education_provision: { protocol_number: '7', protocol_day_month_year: '1 июня 2026 г.' } };
    const merged = mergeVars(current, { ...base, name: 'ЛУЧ' }) as any;
    expect(merged.education_provision).toEqual({ protocol_number: '7', protocol_day_month_year: '1 июня 2026 г.' });
  });

  it('служебные поля хранилища в новую версию не переносятся', () => {
    const merged = mergeVars({ ...base, _id: 'x', block_num: 5, deleted: false } as any, { ...base }) as any;
    expect(merged).not.toHaveProperty('_id');
    expect(merged).not.toHaveProperty('block_num');
    expect(merged).not.toHaveProperty('deleted');
  });

  it('текущих параметров нет — сохраняются присланные', () => {
    expect(mergeVars(null, { ...base })).toEqual(base);
  });
});

describe('prepareVarsUpdate — имя кооператива обязательно и своё', () => {
  it('имя совпадает с узлом — параметры сливаются с текущими', () => {
    const current = { ...base, education_provision: { protocol_number: '7', protocol_day_month_year: '1' } };
    const result = prepareVarsUpdate(current, { ...base, name: 'ЛУЧ' }, 'coop') as any;
    expect(result.name).toBe('ЛУЧ');
    expect(result.education_provision).toBeDefined();
  });

  it('пустое имя — отказ с кодом, параметры не сохраняются', () => {
    expect(() => prepareVarsUpdate(null, { ...base, coopname: '' }, 'coop')).toThrow(
      expect.objectContaining({ code: 'SYSTEM_VARS_COOPNAME_MISMATCH' }),
    );
  });

  it('чужое имя — отказ с кодом', () => {
    expect(() => prepareVarsUpdate(null, { ...base, coopname: 'other' }, 'coop')).toThrow(
      expect.objectContaining({ code: 'SYSTEM_VARS_COOPNAME_MISMATCH' }),
    );
  });
});
