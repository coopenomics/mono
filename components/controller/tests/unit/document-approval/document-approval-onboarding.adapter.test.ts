import { DocumentApprovalOnboardingAdapter } from '~/domain/document-approval/services/document-approval-onboarding.adapter';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '~/domain/document-approval/enums/document-approval.enums';
import type { DocumentTemplateView } from '~/domain/document-approval/interfaces/document-template-view.interface';

jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));

const template = (registry_id: number, over: Partial<DocumentTemplateView> = {}): DocumentTemplateView => ({
  registry_id,
  extension_name: 'core',
  kind: DocumentKind.Form,
  approval: DocumentApprovalRequirement.Required,
  bundle: 'participant_application',
  vars_field: 'participant_application',
  title: `Форма ${registry_id}`,
  order: 1,
  current_version: 2,
  approved_version: null,
  approved_decision_id: null,
  approved_at: null,
  effective_version: 2,
  state: DocumentApprovalState.NotApproved,
  pending_hash: null,
  ...over,
});

function build(templates: DocumentTemplateView[]) {
  const declarations = {
    getByBundle: jest.fn((owner: string, bundle: string) =>
      templates
        .filter((t) => t.extension_name === owner && t.bundle === bundle)
        .map((t) => ({ extension_name: owner, registry_id: t.registry_id, approval: t.approval, bundle, kind: t.kind, order: 1 }))
    ),
  } as any;
  const state = { getTemplates: jest.fn(async () => templates) } as any;
  const proposal = {
    propose: jest.fn(async (input: any) => templates.filter((t) => input.registry_ids.includes(t.registry_id)).map((t) => ({ ...t, state: DocumentApprovalState.Pending, pending_hash: 'HASH9' }))),
  } as any;
  return { adapter: new DocumentApprovalOnboardingAdapter(declarations, state, proposal), proposal };
}

describe('DocumentApprovalOnboardingAdapter', () => {
  it('шаг без объявленных документов фабрика не ведёт', async () => {
    const { adapter } = build([template(100)]);
    expect(await adapter.proposeOnboardingStep({ extension_name: 'chairman', step_key: 'voskhod_membership', username: 'ant' })).toBeNull();
    expect(await adapter.isStepApproved('chairman', 'voskhod_membership')).toBe(false);
  });

  it('шаг председателя ищет документы ядра и выносит весь пакет одним решением с меткой шага', async () => {
    const { adapter, proposal } = build([template(100), template(101)]);
    const result = await adapter.proposeOnboardingStep({ extension_name: 'chairman', step_key: 'participant_application', username: 'ant', title: 'Формы' });

    expect(proposal.propose).toHaveBeenCalledWith({
      coopname: 'voskhod',
      registry_ids: [100, 101],
      username: 'ant',
      title: 'Формы',
      onboarding: { extension: 'chairman', step: 'participant_application' },
    });
    expect(result).toEqual({ hash: 'HASH9', registry_ids: [100, 101], approved: false });
  });

  it('документы шага уже в повестке — возвращается хэш повестки, новое решение не создаётся', async () => {
    const { adapter, proposal } = build([template(100, { state: DocumentApprovalState.Pending, pending_hash: 'OLD' }), template(101, { state: DocumentApprovalState.Pending, pending_hash: 'OLD' })]);
    const result = await adapter.proposeOnboardingStep({ extension_name: 'chairman', step_key: 'participant_application', username: 'ant' });
    expect(result?.hash).toBe('OLD');
    expect(proposal.propose).not.toHaveBeenCalled();
  });

  it('документы шага утверждены (в том числе устаревшей редакцией) — шаг закрыт без решения', async () => {
    const { adapter, proposal } = build([
      template(100, { state: DocumentApprovalState.Approved, approved_version: 2 }),
      template(101, { state: DocumentApprovalState.Outdated, approved_version: 1 }),
    ]);
    const result = await adapter.proposeOnboardingStep({ extension_name: 'chairman', step_key: 'participant_application', username: 'ant' });
    expect(result).toEqual({ hash: null, registry_ids: [100, 101], approved: true });
    expect(proposal.propose).not.toHaveBeenCalled();
    expect(await adapter.isStepApproved('chairman', 'participant_application')).toBe(true);
  });

  it('шаг не закрыт, пока хотя бы один документ пакета не утверждён', async () => {
    const { adapter } = build([template(100, { state: DocumentApprovalState.Approved, approved_version: 2 }), template(101)]);
    expect(await adapter.isStepApproved('chairman', 'participant_application')).toBe(false);
  });

  it('шаги приложений ищут документы под именем самого приложения', async () => {
    const { adapter, proposal } = build([template(1102, { extension_name: 'market', bundle: 'marketplace_offer_template', kind: DocumentKind.Agreement })]);
    await adapter.proposeOnboardingStep({ extension_name: 'market', step_key: 'marketplace_offer_template', username: 'ant' });
    expect(proposal.propose.mock.calls[0][0].onboarding).toEqual({ extension: 'market', step: 'marketplace_offer_template' });
  });
});
