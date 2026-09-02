/** Витрина вступления и роли edubridge: две программы, две оферты; факты ролей по подписям программ. */
import { ProgramKey } from '@coopenomics/innercoop';
import { registerEdubridgeInAgreementRegistry } from '~/extensions/edubridge/application/registration/register-edubridge-in-agreement-registry';
import { EdubridgeRoleFactsAdapter } from '~/extensions/edubridge/application/membership/edubridge-role-facts.adapter';

describe('registerEdubridgeInAgreementRegistry', () => {
  it('регистрирует две оферты и две программы, оферты только через программы', () => {
    const port = { registerAgreement: jest.fn(), registerProgram: jest.fn(), unregisterAgreement: jest.fn(), unregisterProgram: jest.fn() };
    registerEdubridgeInAgreementRegistry(port);
    expect(port.registerAgreement).toHaveBeenCalledTimes(2);
    expect(port.registerProgram).toHaveBeenCalledTimes(2);
    const agreements = port.registerAgreement.mock.calls.map((c) => c[0]);
    expect(agreements.map((a) => a.registry_id)).toEqual([3002, 3004]);
    expect(agreements.every((a) => a.applicable_account_types.length === 0)).toBe(true);
    expect(agreements.every((a) => a.agreement_type.length <= 12)).toBe(true);
    const programs = port.registerProgram.mock.calls.map((c) => c[0]);
    expect(programs.map((p) => p.key)).toEqual([ProgramKey.EDUCATION, ProgramKey.EDUCATION_TEACHING]);
    expect(programs[0].agreement_ids).toEqual(['education_parent_offer']);
    expect(programs[1].agreement_ids).toEqual(['education_teacher_offer']);
  });
});

describe('EdubridgeRoleFactsAdapter', () => {
  const logger = { setContext: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } as any;

  function make(opts: { parentSigned?: boolean; teacherSigned?: boolean; contract?: boolean; admin?: boolean; programs?: boolean }) {
    const council = {
      getCoagreement: jest.fn(async (_c: string, type: string) =>
        opts.programs === false ? null : { program_id: type === 'eduparent' ? 5 : 6 }
      ),
    } as any;
    const programAgreements = {
      findProgramSignature: jest.fn(async (_c: string, _u: string, id: number) =>
        (id === 5 && opts.parentSigned) || (id === 6 && opts.teacherSigned) ? { program_id: id } : null
      ),
    } as any;
    const admins = { findOne: jest.fn(async () => (opts.admin ? { username: 'ant' } : null)) } as any;
    const contracts = { findOne: jest.fn(async () => (opts.contract ? { status: 'pending_approval' } : null)) } as any;
    return new EdubridgeRoleFactsAdapter(council, programAgreements, logger, admins, contracts);
  }

  const none = { isLearner: false, hasTeacherOffer: false, isTeacher: false, isAdmin: false };

  it('подписана оферта родителя → learner; преподавателя + договор → teacher; запись в admins → admin', async () => {
    await expect(make({ parentSigned: true }).resolve('voskhod', 'ant')).resolves.toEqual({ ...none, isLearner: true });
    await expect(make({ teacherSigned: true, contract: true, admin: true }).resolve('voskhod', 'ant')).resolves.toEqual({
      isLearner: false,
      hasTeacherOffer: true,
      isTeacher: true,
      isAdmin: true,
    });
  });

  it('оферта преподавателя без договора УХД → только hasTeacherOffer, роли teacher нет', async () => {
    await expect(make({ teacherSigned: true }).resolve('voskhod', 'ant')).resolves.toEqual({ ...none, hasTeacherOffer: true });
  });

  it('договор без оферты (оферта отозвана) → не преподаватель', async () => {
    await expect(make({ contract: true }).resolve('voskhod', 'ant')).resolves.toEqual(none);
  });

  it('программы ещё не открыты в кооперативе → подписей нет', async () => {
    await expect(make({ parentSigned: true, programs: false }).resolve('voskhod', 'ant')).resolves.toEqual(none);
  });

  it('ошибка порта не роняет вычисление — факт false и предупреждение', async () => {
    const adapter = make({});
    (adapter as any).council.getCoagreement = jest.fn(async () => { throw new Error('chain down'); });
    await expect(adapter.resolve('voskhod', 'ant')).resolves.toEqual(none);
    expect(logger.warn).toHaveBeenCalled();
  });
});
