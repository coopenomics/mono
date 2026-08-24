/**
 * Unit-тесты допуска к роли на компоненте: кто вправе действовать.
 *
 * Что здесь защищается. Операции допуска подписываются от имени кооператива,
 * поэтому имя действующего лица приходит в данных операции, а не выводится из
 * подписи. Если его не сверять с вошедшим пайщиком, любой участник подал бы
 * заявку за другого и сам же её одобрил — а вместе с одобрением фиксируется
 * ставка часа, по которой считается стоимость его работы.
 *
 * Реестр случаев: test-registry/capital.project-roles.yaml
 */

import { RolesManagementInteractor } from '~/extensions/capital/application/use-cases/roles-management.interactor';
import { ProjectRole } from '~/extensions/capital/domain/enums/role-request.enum';

function makeInteractor() {
  const port = {
    requestProjectRole: jest.fn(async () => ({ transaction: { ref_block_num: 1 } })),
    approveProjectRole: jest.fn(async () => ({ transaction: { ref_block_num: 2 } })),
    declineProjectRole: jest.fn(async () => ({ transaction: { ref_block_num: 3 } })),
    inviteProjectRole: jest.fn(async () => ({ transaction: { ref_block_num: 4 } })),
    acceptProjectRoleInvite: jest.fn(async () => ({ transaction: { ref_block_num: 5 } })),
    declineProjectRoleInvite: jest.fn(async () => ({ transaction: { ref_block_num: 6 } })),
    requestRateUpdate: jest.fn(async () => ({ transaction: { ref_block_num: 7 } })),
  } as any;

  return { interactor: new RolesManagementInteractor(port), port };
}

const requestData = {
  coopname: 'voskhod',
  request_hash: 'rh',
  project_hash: 'ph',
  username: 'petrov',
  master: 'ivanov',
  role: ProjectRole.CREATOR,
  rate_per_hour: '1200.0000 RUB',
  hours_per_day: 8,
  description: 'прошу допуск',
};

const inviteData = {
  coopname: 'voskhod',
  request_hash: 'rh',
  project_hash: 'ph',
  candidate: 'petrov',
  master: 'ivanov',
  role: ProjectRole.CREATOR,
  rate_per_hour: '1200.0000 RUB',
  hours_per_day: 8,
  description: 'приглашаю',
};

describe('Допуск к роли: сверка действующего лица', () => {
  it('заявку подаёт сам пайщик — операция уходит в цепь', async () => {
    const { interactor, port } = makeInteractor();

    await interactor.requestProjectRole(requestData, 'petrov');

    expect(port.requestProjectRole).toHaveBeenCalledTimes(1);
  });

  it('заявку за другого пайщика подать нельзя', async () => {
    const { interactor, port } = makeInteractor();

    await expect(interactor.requestProjectRole(requestData, 'sidorov')).rejects.toThrow();
    expect(port.requestProjectRole).not.toHaveBeenCalled();
  });

  it('решение по заявке принимает мастер компонента', async () => {
    const { interactor, port } = makeInteractor();
    const data = { coopname: 'voskhod', request_hash: 'rh', master: 'ivanov', approved_rate: '1200.0000 RUB', approved_hours: 8 };

    await interactor.approveProjectRole(data, 'ivanov');

    expect(port.approveProjectRole).toHaveBeenCalledTimes(1);
  });

  it('заявитель не может одобрить себе допуск и ставку часа', async () => {
    const { interactor, port } = makeInteractor();
    const data = { coopname: 'voskhod', request_hash: 'rh', master: 'ivanov', approved_rate: '9900.0000 RUB', approved_hours: 8 };

    await expect(interactor.approveProjectRole(data, 'petrov')).rejects.toThrow();
    expect(port.approveProjectRole).not.toHaveBeenCalled();
  });

  it('отказ по заявке выносит мастер компонента, а не заявитель', async () => {
    const { interactor, port } = makeInteractor();
    const data = { coopname: 'voskhod', request_hash: 'rh', master: 'ivanov', reason: 'нет задач' };

    await expect(interactor.declineProjectRole(data, 'petrov')).rejects.toThrow();
    expect(port.declineProjectRole).not.toHaveBeenCalled();
  });

  it('приглашение отправляет мастер компонента', async () => {
    const { interactor, port } = makeInteractor();

    await interactor.inviteProjectRole(inviteData, 'ivanov');

    expect(port.inviteProjectRole).toHaveBeenCalledTimes(1);
  });

  it('пригласить самого себя мастер не может', async () => {
    const { interactor, port } = makeInteractor();
    const data = { ...inviteData, candidate: 'ivanov' };

    await expect(interactor.inviteProjectRole(data, 'ivanov')).rejects.toThrow();
    expect(port.inviteProjectRole).not.toHaveBeenCalled();
  });

  it('приглашение на роль мастера может быть адресовано и самому себе — мастера в проекте может ещё не быть', async () => {
    const { interactor, port } = makeInteractor();
    const data = { ...inviteData, candidate: 'ivanov', role: ProjectRole.MASTER };

    await interactor.inviteProjectRole(data, 'ivanov');

    expect(port.inviteProjectRole).toHaveBeenCalledTimes(1);
  });

  it('принять приглашение может только тот, кому оно адресовано', async () => {
    const { interactor, port } = makeInteractor();
    const data = { coopname: 'voskhod', request_hash: 'rh', username: 'petrov' };

    await expect(interactor.acceptProjectRoleInvite(data, 'sidorov')).rejects.toThrow();
    expect(port.acceptProjectRoleInvite).not.toHaveBeenCalled();

    await interactor.acceptProjectRoleInvite(data, 'petrov');
    expect(port.acceptProjectRoleInvite).toHaveBeenCalledTimes(1);
  });

  it('отказаться от приглашения может только тот, кому оно адресовано', async () => {
    const { interactor, port } = makeInteractor();
    const data = { coopname: 'voskhod', request_hash: 'rh', username: 'petrov', reason: 'занят' };

    await expect(interactor.declineProjectRoleInvite(data, 'sidorov')).rejects.toThrow();
    expect(port.declineProjectRoleInvite).not.toHaveBeenCalled();
  });

  it('заявку на новую ставку часа подаёт сам пайщик', async () => {
    const { interactor, port } = makeInteractor();
    const data = {
      coopname: 'voskhod', request_hash: 'rh', project_hash: 'ph',
      username: 'petrov', master: 'ivanov', new_rate: '1400.0000 RUB', new_hours: 8,
    };

    await expect(interactor.requestRateUpdate(data, 'ivanov')).rejects.toThrow();
    expect(port.requestRateUpdate).not.toHaveBeenCalled();

    await interactor.requestRateUpdate(data, 'petrov');
    expect(port.requestRateUpdate).toHaveBeenCalledTimes(1);
  });

  it('незаполненное пояснение уходит в цепь пустой строкой, а не пропущенным полем', async () => {
    const { interactor, port } = makeInteractor();
    const { description, ...withoutDescription } = requestData;

    await interactor.requestProjectRole(withoutDescription as typeof requestData, 'petrov');

    expect(port.requestProjectRole).toHaveBeenCalledWith(expect.objectContaining({ description: '' }));
  });
});
