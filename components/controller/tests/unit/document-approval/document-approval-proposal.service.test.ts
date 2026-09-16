import { DecisionTrackedEvent } from '@coopenomics/innercoop';
import {
  DOCUMENT_APPROVAL_DECLINED_EVENT,
  DOCUMENT_APPROVAL_RULE_KIND,
  DocumentApprovalProposalService,
} from '~/domain/document-approval/services/document-approval-proposal.service';
import { toChainTimePoint } from '~/domain/document-approval/services/decision-date';
import { DocumentApprovalRequirement, DocumentApprovalState, DocumentKind } from '~/domain/document-approval/enums/document-approval.enums';
import type { DocumentTemplateView } from '~/domain/document-approval/interfaces/document-template-view.interface';
import { sha256 } from '~/utils/sha256';

jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

const template = (registry_id: number, over: Partial<DocumentTemplateView> = {}): DocumentTemplateView => ({
  registry_id,
  extension_name: 'core',
  kind: DocumentKind.Agreement,
  approval: DocumentApprovalRequirement.Required,
  bundle: 'privacy_agreement',
  vars_field: 'privacy_agreement',
  title: 'Политика',
  order: 30,
  current_version: 4,
  approved_version: 3,
  approved_decision_id: 12,
  approved_at: '2026-09-01T00:00:00',
  effective_version: 3,
  state: DocumentApprovalState.Outdated,
  pending_hash: null,
  ...over,
});

function build(templates: DocumentTemplateView[]) {
  const state = { getTemplates: jest.fn(async () => templates) } as any;
  const declarations = {} as any;
  const freeDecision = {
    createProjectOfFreeDecision: jest.fn(async () => ({})),
    generateProjectOfFreeDecisionDocument: jest.fn(async () => ({ hash: 'HASH1', meta: { title: 'Проект', version: '1.0' } })),
    publishProjectOfFreeDecision: jest.fn(async () => true),
  } as any;
  const rules: any[] = [];
  const tracking = {
    registerTrackingRule: jest.fn(async (input: any) => {
      const rule = { id: `rule-${rules.length + 1}`, active: true, created_at: new Date(), ...input };
      rules.push(rule);
      return rule;
    }),
    getActiveRules: jest.fn(async () => rules.filter((r) => r.active)),
    deactivateRule: jest.fn(async (id: string) => {
      const rule = rules.find((r) => r.id === id);
      if (rule) rule.active = false;
    }),
  } as any;
  const draftChain = { approveDraft: jest.fn(async () => ({})) } as any;
  const sovietChain = { getDecisions: jest.fn(async () => [{ id: 55, hash: 'hash1' }]) } as any;
  const blockchain = { getInfo: jest.fn(async () => ({ head_block_num: 12345 })) } as any;
  const documents = {
    generateDocument: jest.fn(async ({ data }: any) => ({ html: `<p>текст ${data.registry_id}</p>`, meta: { title: `Документ ${data.registry_id}` } })),
    generateBlank: jest.fn(async ({ registry_id }: any) => ({ title: `Форма ${registry_id}`, html: `<p>бланк ${registry_id}: ______</p>`, meta: {} })),
  } as any;
  const eventEmitter = { emit: jest.fn() } as any;
  const service = new DocumentApprovalProposalService(
    state,
    declarations,
    freeDecision,
    tracking,
    draftChain,
    sovietChain,
    blockchain,
    documents,
    eventEmitter,
    logger
  );
  return { service, state, freeDecision, tracking, draftChain, sovietChain, documents, eventEmitter, rules };
}

describe('DocumentApprovalProposalService.propose', () => {
  it('выносит документ на совет: бланк из цепи, проект решения с хэшем текста, правило отслеживания с номером решения', async () => {
    const { service, freeDecision, tracking, documents } = build([template(3)]);

    await service.propose({ coopname: 'voskhod', registry_ids: [3], username: 'ant' });

    expect(documents.generateDocument).toHaveBeenCalledWith({
      data: { coopname: 'voskhod', username: 'voskhod', registry_id: 3, block_num: 12345 },
      options: { skip_save: true, skip_pdf: true, blank_signer: true },
    });
    const project = freeDecision.createProjectOfFreeDecision.mock.calls[0][0];
    expect(project.question).toContain('редакции № 4');
    expect(project.decision).toContain('<p>текст 3</p>');
    expect(project.decision).toMatch(/хэш текста [0-9a-f]{64}/);
    expect(freeDecision.publishProjectOfFreeDecision).toHaveBeenCalledTimes(1);

    const rule = tracking.registerTrackingRule.mock.calls[0][0];
    expect(rule.hash).toBe('HASH1');
    expect(rule.vars_field).toBe('privacy_agreement');
    expect(rule.metadata.kind).toBe(DOCUMENT_APPROVAL_RULE_KIND);
    expect(rule.metadata.registry_ids).toEqual([3]);
    expect(rule.metadata.versions).toEqual({ '3': 4 });
    expect(rule.metadata.decision_id).toBe(55);
    expect(rule.metadata.onboarding_step).toBe('privacy_agreement');
  });

  it('пакет из двух документов уходит одним решением; поля vars разные — реквизиты протокола не пишутся', async () => {
    const { service, freeDecision, tracking } = build([
      template(100, { bundle: 'participant_application', vars_field: 'participant_application', kind: DocumentKind.Form, current_version: 7, approved_version: null, state: DocumentApprovalState.NotApproved }),
      template(101, { bundle: 'participant_application', vars_field: 'other_field', kind: DocumentKind.Form, current_version: 4, approved_version: null, state: DocumentApprovalState.NotApproved }),
    ]);

    await service.propose({ coopname: 'voskhod', registry_ids: [100, 101], username: 'ant' });

    expect(freeDecision.publishProjectOfFreeDecision).toHaveBeenCalledTimes(1);
    const rule = tracking.registerTrackingRule.mock.calls[0][0];
    expect(rule.metadata.registry_ids).toEqual([100, 101]);
    expect(rule.metadata.versions).toEqual({ '100': 7, '101': 4 });
    expect(rule.vars_field).toBe('');
  });

  it('документ уже в повестке — повторное вынесение ничего не создаёт', async () => {
    const { service, freeDecision } = build([template(3, { state: DocumentApprovalState.Pending, pending_hash: 'x' })]);
    await service.propose({ coopname: 'voskhod', registry_ids: [3], username: 'ant' });
    expect(freeDecision.publishProjectOfFreeDecision).not.toHaveBeenCalled();
  });

  it('утверждённую редакцию, служебный документ и чужой кооператив отвергает', async () => {
    const { service } = build([
      template(3, { state: DocumentApprovalState.Approved, approved_version: 4 }),
      template(600, { kind: DocumentKind.Service, approval: DocumentApprovalRequirement.None, state: DocumentApprovalState.NotRequired }),
      template(1000, { extension_name: 'capital' }),
    ]);
    await expect(service.propose({ coopname: 'voskhod', registry_ids: [3], username: 'ant' })).rejects.toThrow(/уже утверждена/);
    await expect(service.propose({ coopname: 'voskhod', registry_ids: [600], username: 'ant' })).rejects.toThrow(/не требует утверждения/);
    await expect(service.propose({ coopname: 'voskhod', registry_ids: [1000, 4], username: 'ant' })).rejects.toThrow(/одного приложения|не объявлен/);
    await expect(service.propose({ coopname: 'other', registry_ids: [3], username: 'ant' })).rejects.toThrow(/не обслуживается/);
  });
});

describe('DocumentApprovalProposalService: решение совета', () => {
  it('по своему правилу пишет утверждение каждой редакции в цепь с номером и датой решения', async () => {
    const { service, draftChain } = build([]);
    await service.handleDecisionTracked(
      new DecisionTrackedEvent({
        matched: true,
        rule_id: 'r1',
        hash: 'HASH1',
        event_type: 'soviet_decision' as any,
        vars_field: '',
        decision_id: '77',
        decision_date: '12.02.2026 10:30',
        metadata: {
          kind: DOCUMENT_APPROVAL_RULE_KIND,
          registry_ids: [100, 101],
          versions: { '100': 7, '101': 4 },
          text_hashes: { '100': 'a'.repeat(64), '101': 'b'.repeat(64) },
        },
      } as any)
    );
    expect(draftChain.approveDraft).toHaveBeenCalledTimes(2);
    expect(draftChain.approveDraft).toHaveBeenCalledWith({
      coopname: 'voskhod',
      username: 'voskhod',
      registry_id: 100,
      version: 7,
      decision_id: 77,
      approved_at: '2026-02-12T10:30:00',
      text_hash: 'a'.repeat(64),
    });
  });

  it('чужое правило отслеживания не трогает', async () => {
    const { service, draftChain } = build([]);
    await service.handleDecisionTracked(
      new DecisionTrackedEvent({ matched: true, hash: 'h', event_type: 'soviet_decision', vars_field: 'x', metadata: { onboarding_step: 'general_meet' } } as any)
    );
    expect(draftChain.approveDraft).not.toHaveBeenCalled();
  });

  it('отклонение решения снимает правило и сообщает об этом', async () => {
    const { service, tracking, eventEmitter } = build([template(3)]);
    await service.propose({ coopname: 'voskhod', registry_ids: [3], username: 'ant' });

    await service.handleDeclined({ data: { coopname: 'voskhod', decision_id: '55' } } as any);

    expect(tracking.deactivateRule).toHaveBeenCalledWith('rule-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DOCUMENT_APPROVAL_DECLINED_EVENT,
      expect.objectContaining({ registry_ids: [3], decision_id: 55, reason: 'declined' })
    );
    expect(await tracking.getActiveRules()).toEqual([]);
  });

  it('отклонение чужого решения правило не трогает', async () => {
    const { service, tracking } = build([template(3)]);
    await service.propose({ coopname: 'voskhod', registry_ids: [3], username: 'ant' });
    await service.handleExpired({ data: { coopname: 'voskhod', decision_id: '999' } } as any);
    expect(tracking.deactivateRule).not.toHaveBeenCalled();
  });
});

describe('toChainTimePoint', () => {
  it('переводит дату документа и ISO в формат контракта, непонятное отдаёт null', () => {
    expect(toChainTimePoint('12.02.2026 10:30')).toBe('2026-02-12T10:30:00');
    expect(toChainTimePoint('12.02.2026')).toBe('2026-02-12T00:00:00');
    expect(toChainTimePoint('2026-02-12T10:30:00.000Z')).toBe('2026-02-12T10:30:00');
    expect(toChainTimePoint('вчера')).toBeNull();
    expect(toChainTimePoint(undefined)).toBeNull();
  });
});

describe('DocumentApprovalProposalService: документ без данных события', () => {
  it('в решение уходит бланк формы с прочерками, а не хэш; хэш утверждения — от текста бланка', async () => {
    const { service, documents, freeDecision, tracking } = build([template(900, { bundle: 'core_forms', vars_field: undefined, kind: DocumentKind.Form })]);
    documents.generateDocument.mockRejectedValueOnce(new Error('Платежный метод с ID undefined не найден'));

    await service.propose({ coopname: 'voskhod', registry_ids: [900], username: 'ant' });

    expect(documents.generateBlank).toHaveBeenCalledWith({ coopname: 'voskhod', registry_id: 900, block_num: 12345 });
    const project = freeDecision.createProjectOfFreeDecision.mock.calls[0][0];
    expect(project.decision).toContain('<p>бланк 900: ______</p>');
    expect(project.decision).not.toContain('реестре шаблонов');
    expect(tracking.registerTrackingRule.mock.calls[0][0].metadata.text_hashes).toEqual({ '900': sha256('<p>бланк 900: ______</p>') });
  });

  it('бланк утверждённой редакции собирается без явного блока — источник данных подставит её сам', async () => {
    const { service, documents } = build([template(900, { bundle: 'core_forms', vars_field: undefined, kind: DocumentKind.Form })]);
    documents.generateDocument.mockRejectedValueOnce(new Error('Пользователь не найден'));

    const blank = await service.renderBlankHtml('voskhod', 900, 'approved');

    expect(documents.generateBlank).toHaveBeenCalledWith({ coopname: 'voskhod', registry_id: 900 });
    expect(blank.html).toContain('______');
    expect(blank.title).toBe('Форма 900');
  });
});
