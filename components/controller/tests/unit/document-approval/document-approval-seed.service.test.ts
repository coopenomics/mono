import { DocumentApprovalSeedService } from '~/domain/document-approval/services/document-approval-seed.service';
import { toChainTimePoint } from '~/domain/document-approval/services/decision-date';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '~/domain/document-approval/enums/document-approval.enums';
import type { DocumentTemplateView } from '~/domain/document-approval/interfaces/document-template-view.interface';

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod', document_approval: { reminder_enabled: true, reminder_cron: '0 9 * * 1', seed_on_start: true } },
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
  current_version: 3,
  approved_version: null,
  approved_decision_id: null,
  approved_at: null,
  effective_version: 3,
  state: DocumentApprovalState.NotApproved,
  pending_hash: null,
  ...over,
});

function build(templates: DocumentTemplateView[], vars: Record<string, unknown> | null) {
  const state = {
    getTemplates: jest.fn(async () => templates),
    getCurrentTextHash: jest.fn(async () => 'c'.repeat(64)),
  } as any;
  const varsPort = { get: jest.fn(async () => vars) } as any;
  const draftChain = { approveDraft: jest.fn(async (data: any) => { if (data.registry_id === 4) throw new Error('цепь недоступна'); return {}; }) } as any;
  return { service: new DocumentApprovalSeedService(state, varsPort, draftChain, logger), draftChain };
}

const vars = {
  coopname: 'voskhod',
  wallet_agreement: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
  privacy_agreement: { protocol_number: '12', protocol_day_month_year: '09.02.2026 10:24' },
  user_agreement: { protocol_number: '', protocol_day_month_year: '' },
};

describe('DocumentApprovalSeedService.plan', () => {
  it('переносит только документы с реквизитами протокола и без утверждения; номер не число — 0', async () => {
    const { service } = build(
      [
        template(1, { vars_field: 'wallet_agreement' }),
        template(3, { vars_field: 'privacy_agreement', current_version: 4 }),
        template(4, { vars_field: 'user_agreement' }),
        template(2, { vars_field: 'signature_agreement' }),
        template(50, { vars_field: 'coopenomics_agreement', approved_version: 2, state: DocumentApprovalState.Approved }),
        template(600, { approval: DocumentApprovalRequirement.None, state: DocumentApprovalState.NotRequired }),
        template(100, { vars_field: 'wallet_agreement', current_version: null }),
      ],
      vars
    );
    const plan = await service.plan('voskhod');
    expect(plan.map((p) => p.registry_id)).toEqual([1, 3]);
    expect(plan[0]).toMatchObject({ version: 3, decision_id: 0, approved_at: '2024-04-10T00:00:00', protocol_number: '10-04-2024' });
    expect(plan[1]).toMatchObject({ version: 4, decision_id: 12, approved_at: '2026-02-09T10:24:00' });
  });

  it('без настроек кооператива план пуст', async () => {
    const { service } = build([template(1, { vars_field: 'wallet_agreement' })], null);
    expect(await service.plan('voskhod')).toEqual([]);
  });
});

describe('DocumentApprovalSeedService.apply', () => {
  it('пишет утверждение каждой строки плана от имени кооператива; сбой одного документа не останавливает остальные', async () => {
    const { service, draftChain } = build(
      [template(1, { vars_field: 'wallet_agreement' }), template(4, { vars_field: 'privacy_agreement' }), template(3, { vars_field: 'privacy_agreement' })],
      vars
    );
    const result = await service.apply('voskhod');
    expect(result).toEqual({ planned: 3, applied: 2, failed: [4] });
    expect(draftChain.approveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: 'voskhod', username: 'voskhod', registry_id: 1, version: 3, decision_id: 0, text_hash: 'c'.repeat(64) })
    );
  });

  it('повторный запуск ничего не пишет: документы с утверждением в план не попадают', async () => {
    const { service, draftChain } = build([template(1, { vars_field: 'wallet_agreement', approved_version: 3, state: DocumentApprovalState.Approved })], vars);
    expect(await service.apply('voskhod')).toEqual({ planned: 0, applied: 0, failed: [] });
    expect(draftChain.approveDraft).not.toHaveBeenCalled();
  });
});

describe('toChainTimePoint: даты протоколов из прежних настроек', () => {
  it('понимает русскую длинную дату', () => {
    expect(toChainTimePoint('10 апреля 2024 г.')).toBe('2024-04-10T00:00:00');
    expect(toChainTimePoint('1 сентября 2026')).toBe('2026-09-01T00:00:00');
    expect(toChainTimePoint('10 мартобря 2024 г.')).toBeNull();
  });
});
