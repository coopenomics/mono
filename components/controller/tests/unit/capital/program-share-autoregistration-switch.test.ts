/**
 * Переключатель автоматической регистрации долей держателей Благороста.
 *
 * На стенде внешнего слоя автоматика выключается, пока идут boot-тесты
 * контракта: они шлют действия прямо в цепь, а доли, заведённые параллельно,
 * делали точный расчёт премий вкладчиков зависимым от гонки (решение владельца
 * 25.09.2026, C28-80). Везде, кроме стенда, автоматика включена.
 */
import {
  ProgramShareRegistrationService,
  programShareAutoRegistrationEnabled,
} from '~/extensions/capital/application/services/program-share-registration.service';

describe('переключатель автоматической регистрации долей', () => {
  const saved = process.env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION;
  afterEach(() => {
    if (saved === undefined) delete process.env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION;
    else process.env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION = saved;
  });

  it('по умолчанию включена; выключает только явное off', () => {
    expect(programShareAutoRegistrationEnabled({})).toBe(true);
    expect(programShareAutoRegistrationEnabled({ CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION: 'on' })).toBe(true);
    expect(programShareAutoRegistrationEnabled({ CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION: ' OFF ' })).toBe(false);
  });

  function build() {
    const contributors = { findAll: jest.fn(async () => []) };
    const projects = { findAll: jest.fn(async () => [{ coopname: 'voskhod', status: 'active', project_hash: 'p' }]) };
    const chain = { getSegmentByProjectUser: jest.fn(), registerShare: jest.fn() };
    const wallets = { getProgramWallet: jest.fn() };
    const service = new ProgramShareRegistrationService(contributors as any, projects as any, chain as any, wallets as any);
    return { service, contributors, projects };
  }

  it('выключена — ни событие проекта, ни событие кошелька, ни расписание не читают участников', async () => {
    process.env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION = 'off';
    const m = build();

    await m.service.syncProgramSharesForProject('voskhod', 'p');
    await m.service.syncProgramSharesForUser('voskhod', 'ant');
    await m.service.syncProgramSharesForCoop('voskhod');

    expect(m.contributors.findAll).not.toHaveBeenCalled();
    expect(m.projects.findAll).not.toHaveBeenCalled();
  });

  it('включена — событие проекта обходит участников', async () => {
    delete process.env.CAPITAL_PROGRAM_SHARE_AUTOREGISTRATION;
    const m = build();

    await m.service.syncProgramSharesForProject('voskhod', 'p');

    expect(m.contributors.findAll).toHaveBeenCalled();
  });
});
