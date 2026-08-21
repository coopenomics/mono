/** Административный контур: контакты только владельцу (уровень данных), повтор задач, состояние площадок. */
import { EdubridgeAdminService } from '~/extensions/edubridge/application/services/edubridge-admin.service';
import { EduAccessCarrier, EduConnectorHealth } from '~/extensions/edubridge/domain/enums';
import { canAccess } from '~/extensions/edubridge/application/access/edubridge-access-matrix';

function make() {
  const learner = { id: 'L1', display_name: 'Петя', recipient_type: 'email', recipient_value: 'petya@x.ru', is_self: false, created_at: new Date() } as any;
  const admins = { memberRows: jest.fn(async () => []), listAdmins: jest.fn(async () => []), appoint: jest.fn(), dismiss: jest.fn() } as any;
  const learners = { findByMember: jest.fn(async () => [learner]) } as any;
  const enrollments = { findByMember: jest.fn(async () => []) } as any;
  const courses = { findById: jest.fn(async () => null), findPage: jest.fn(async () => ({ items: [] })) } as any;
  const tasks = { findByEnrollment: jest.fn(async () => []), findQueue: jest.fn(async () => []) } as any;
  const binding = { carrier: EduAccessCarrier.SKILLSPACE, enabled: true, health: EduConnectorHealth.UNKNOWN, last_check_at: null, last_check_message: null };
  const bindings = { ensure: jest.fn(async () => binding), touch: jest.fn(), save: jest.fn() } as any;
  const connectors = { list: jest.fn(() => [{ carrier: EduAccessCarrier.SKILLSPACE }]), get: jest.fn() } as any;
  const outbox = { retry: jest.fn(async () => ({ id: 'T1', status: 'pending', attempts: 3, next_attempt_at: new Date(), created_at: new Date(), updated_at: new Date() })) } as any;
  const config = { get: () => ({ connectors: { skillspace_api_key: 'k', getcourse_account: '', getcourse_api_key: '' } }) } as any;
  return new EdubridgeAdminService(admins, learners, enrollments, courses, tasks, bindings, connectors, outbox, config);
}

describe('EdubridgeAdminService', () => {
  it('карточка пайщика: администратор не получает контакт, владелец получает', async () => {
    const s = make();
    const forAdmin = await s.memberCard('voskhod', 'ant', canAccess(['admin'], 'EduContacts', 'read'));
    const forOwner = await s.memberCard('voskhod', 'ant', canAccess(['owner'], 'EduContacts', 'read'));
    expect(forAdmin.learners[0]!.recipient_value).toBeNull();
    expect(forOwner.learners[0]!.recipient_value).toBe('petya@x.ru');
  });

  it('состояние площадок: ключи наружу не идут, только признак «задано»', async () => {
    const s = make();
    const [b] = await s.connectorsState('voskhod');
    expect(b!.configured).toBe(true);
    expect(JSON.stringify(b)).not.toContain('"k"');
  });

  it('повтор задачи — через outbox, счётчик не сбрасывается', async () => {
    const s = make();
    const t = await s.retry('voskhod', 'T1');
    expect(t.attempts).toBe(3);
  });
});
