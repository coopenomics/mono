import { Workflows } from '@coopenomics/notifications';
import { DocumentApprovalNotificationService } from '~/domain/document-approval/services/document-approval-notification.service';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '~/domain/document-approval/enums/document-approval.enums';
import type { DocumentTemplateView } from '~/domain/document-approval/interfaces/document-template-view.interface';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod', document_approval: { reminder_enabled: true, reminder_cron: '0 9 * * 1' } },
}));
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ frontendUrl: 'https://coop.example', coopname: 'voskhod' }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

const template = (registry_id: number, over: Partial<DocumentTemplateView> = {}): DocumentTemplateView => ({
  registry_id,
  extension_name: 'core',
  kind: DocumentKind.Agreement,
  approval: DocumentApprovalRequirement.Required,
  bundle: null,
  vars_field: null,
  title: `Документ ${registry_id}`,
  order: 1,
  current_version: 4,
  approved_version: 3,
  approved_decision_id: 1,
  approved_at: null,
  effective_version: 3,
  state: DocumentApprovalState.Outdated,
  pending_hash: null,
  ...over,
});

function build(templates: DocumentTemplateView[], chairman: any = { username: 'ant', provider_account: { subscriber_id: 'sub-1', email: 'ant@example.com' } }) {
  const notifications = { notify: jest.fn(async () => ({ acknowledged: true, outboxIds: ['1'] })) } as any;
  const accounts = {
    getAccounts: jest.fn(async () => ({ items: chairman ? [chairman] : [] })),
    getDisplayName: jest.fn(async () => 'Иванов Иван'),
  } as any;
  const vars = { get: jest.fn(async () => ({ coopname: 'voskhod', shortAbbr: 'ПК', name: 'ВОСХОД' })) } as any;
  const declarations = {
    getByRegistryId: jest.fn((id: number) => templates.find((t) => t.registry_id === id) ? { registry_id: id, approval: 'required' } : null),
  } as any;
  const state = { getTemplates: jest.fn(async () => templates) } as any;
  const service = new DocumentApprovalNotificationService(notifications, accounts, vars, declarations, state, logger);
  return { service, notifications, accounts };
}

describe('DocumentApprovalNotificationService', () => {
  it('новая редакция объявленного документа — уведомление председателю с названием и номером редакции', async () => {
    const { service, notifications } = build([template(3, { title: 'Политика' })]);
    await service.handleUpVersion({ data: { scope: 'draft', username: 'eosio', registry_id: '3' } } as any);

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const call = notifications.notify.mock.calls[0][0];
    expect(call.workflowId).toBe(Workflows.DocumentEditionAvailable.id);
    expect(call.to).toEqual({ subscriberId: 'sub-1', email: 'ant@example.com', username: 'ant' });
    expect(call.payload).toMatchObject({ documentTitle: 'Политика', version: '4', short_abbr: 'ПК', name: 'ВОСХОД' });
    expect(call.payload.templatesUrl).toBe('https://coop.example/voskhod/documents/templates');
  });

  it('редакция шаблона, не объявленного в кооперативе, или в чужой области — молчание', async () => {
    const { service, notifications } = build([template(3)]);
    await service.handleUpVersion({ data: { scope: 'draft', registry_id: '999' } } as any);
    await service.handleUpVersion({ data: { scope: 'voskhod', registry_id: '3' } } as any);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('отклонённое решение — уведомление с названиями документов и причиной', async () => {
    const { service, notifications } = build([template(3, { title: 'Политика' }), template(4, { title: 'Соглашение' })]);
    await service.handleDeclined({ coopname: 'voskhod', registry_ids: [3, 4], decision_id: 55, reason: 'expired' });

    const call = notifications.notify.mock.calls[0][0];
    expect(call.workflowId).toBe(Workflows.DocumentApprovalDeclined.id);
    expect(call.payload).toMatchObject({ documentTitles: '«Политика», «Соглашение»', decision_id: '55', reasonText: 'снято как не рассмотренное в срок' });
  });

  it('напоминание уходит только когда есть документы без утверждённой текущей редакции', async () => {
    const waiting = build([
      template(3, { state: DocumentApprovalState.Outdated }),
      template(100, { state: DocumentApprovalState.NotApproved, kind: DocumentKind.Form }),
      template(4, { state: DocumentApprovalState.Approved }),
      template(600, { state: DocumentApprovalState.NotRequired, approval: DocumentApprovalRequirement.None }),
      template(1, { state: DocumentApprovalState.Pending }),
    ]);
    expect(await waiting.service.sendReminder()).toBe(2);
    expect(waiting.notifications.notify.mock.calls[0][0].workflowId).toBe(Workflows.DocumentEditionReminder.id);
    expect(waiting.notifications.notify.mock.calls[0][0].payload.count).toBe('2');

    const calm = build([template(4, { state: DocumentApprovalState.Approved })]);
    expect(await calm.service.sendReminder()).toBe(0);
    expect(calm.notifications.notify).not.toHaveBeenCalled();
  });

  it('без председателя или его подписки уведомление не отправляется и ошибки нет', async () => {
    const { service, notifications } = build([template(3)], null);
    await service.handleUpVersion({ data: { scope: 'draft', registry_id: '3' } } as any);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
