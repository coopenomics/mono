/**
 * Отметка «онбординг завершён» в настройках кооператива. Председатель ставит её
 * кнопкой на последнем шаге онбординга, по ней пункт «Онбординг» уходит из меню
 * на всех устройствах (до 19.10.2026 отметка жила в localStorage браузера).
 * Настройки переписываются и другими путями — отметку они обнулять не должны.
 */
import { SettingsDomainEntity } from '~/domain/settings/entities/settings-domain.entity';
import { SettingsKyselyRepository } from '~/infrastructure/database/kysely/repositories/settings.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

const BASE = {
  coopname: 'voskhod',
  provider_name: 'qrpay',
  authorized_default_workspace: 'participant',
  authorized_default_route: 'wallet',
  non_authorized_default_workspace: 'participant',
  non_authorized_default_route: 'signup',
  created_at: new Date('2026-10-01T00:00:00Z'),
  updated_at: new Date('2026-10-01T00:00:00Z'),
};

describe('настройки кооператива — завершение онбординга', () => {
  it('отметка проходит через сущность и не сбрасывается обновлением других полей', () => {
    const at = new Date('2026-10-19T12:00:00Z');
    const entity = new SettingsDomainEntity({ ...BASE, onboarding_completed_at: at });
    entity.update({ authorized_default_route: 'agenda' });
    expect(entity.onboarding_completed_at).toEqual(at);
    expect(entity.authorized_default_route).toBe('agenda');
  });

  it('у кооператива без отметки — пусто, а не undefined', () => {
    expect(new SettingsDomainEntity(BASE).onboarding_completed_at).toBeNull();
  });

  it('запись без отметки не трогает колонку — завершённый онбординг не обнуляется', async () => {
    const { db, queries } = recordingKysely([{ rows: [{ ...BASE, onboarding_completed_at: null, extra_settings: {} }] }]);
    await new SettingsKyselyRepository(db).upsert({ ...BASE });
    expect(queries[0].sql).not.toContain('onboarding_completed_at');
  });

  it('запись с отметкой пишет колонку', async () => {
    const at = new Date('2026-10-19T12:00:00Z');
    const { db, queries } = recordingKysely([{ rows: [{ ...BASE, onboarding_completed_at: at, extra_settings: {} }] }]);
    const saved = await new SettingsKyselyRepository(db).upsert({ ...BASE, onboarding_completed_at: at });
    expect(queries[0].sql).toContain('onboarding_completed_at');
    expect(queries[0].parameters).toContain(at);
    expect(saved.onboarding_completed_at).toEqual(at);
  });
});
