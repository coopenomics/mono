import { DocumentApprovalStateService } from '~/domain/document-approval/services/document-approval-state.service';
import { DocumentDeclarationsRegistryService } from '~/domain/document-approval/services/document-declarations-registry.service';
import { DocumentApprovalState } from '~/domain/document-approval/enums/document-approval.enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() } as any;

function makeService(opts: {
  drafts: Array<{ registry_id: number; version: number; title?: string }>;
  approvals: Array<{ registry_id: number; version: number; decision_id: number; approved_at?: string }>;
  rules?: Array<{ hash: string; metadata: Record<string, unknown> }>;
}) {
  const declarations = new DocumentDeclarationsRegistryService(logger);
  const blockchain = {
    getAllRows: jest.fn(async (_code: string, scope: string, table: string) => {
      if (table === 'drafts') return opts.drafts;
      if (table === 'approvals' && scope === 'voskhod') return opts.approvals;
      return [];
    }),
  } as any;
  const tracking = { getActiveRules: jest.fn(async () => opts.rules ?? []) } as any;
  const service = new DocumentApprovalStateService(declarations, blockchain, tracking, logger);
  return { service, declarations, blockchain, tracking };
}

describe('DocumentApprovalStateService', () => {
  it('сводит декларации с редакцией в сети, утверждением и повесткой', async () => {
    const { service, declarations } = makeService({
      drafts: [
        { registry_id: 3, version: 4, title: 'Политика' },
        { registry_id: 4, version: 3, title: 'Пользовательское соглашение' },
        { registry_id: 1, version: 3, title: 'Кошелёк' },
        { registry_id: 600, version: 2, title: 'Протокол' },
      ],
      approvals: [
        { registry_id: 3, version: 3, decision_id: 12, approved_at: '2026-09-01T00:00:00' },
        { registry_id: 4, version: 3, decision_id: 13, approved_at: '2026-09-01T00:00:00' },
      ],
      rules: [{ hash: 'abc', metadata: { registry_ids: [1], version: 3 } }],
    });
    await declarations.onModuleInit();

    const templates = await service.getTemplates('voskhod');
    const byId = new Map(templates.map((t) => [t.registry_id, t]));

    expect(byId.get(3)?.state).toBe(DocumentApprovalState.Outdated);
    expect(byId.get(3)?.effective_version).toBe(3);
    expect(byId.get(3)?.approved_decision_id).toBe(12);
    expect(byId.get(3)?.title).toBe('Политика');

    expect(byId.get(4)?.state).toBe(DocumentApprovalState.Approved);

    expect(byId.get(1)?.state).toBe(DocumentApprovalState.Pending);
    expect(byId.get(1)?.pending_hash).toBe('abc');
    expect(byId.get(1)?.effective_version).toBe(3);

    expect(byId.get(600)?.state).toBe(DocumentApprovalState.NotRequired);
    expect(byId.get(2)?.state).toBe(DocumentApprovalState.NotApproved);
    expect(byId.get(2)?.current_version).toBeNull();
  });

  it('эффективная редакция — утверждённая, а без утверждения текущая', async () => {
    const { service } = makeService({
      drafts: [{ registry_id: 3, version: 4 }, { registry_id: 1, version: 3 }],
      approvals: [{ registry_id: 3, version: 3, decision_id: 12 }],
    });
    const versions = await service.getEffectiveVersions('voskhod');
    expect(versions.get(3)).toBe(3);
    expect(versions.get(1)).toBe(3);
  });

  it('таблицы цепи читаются один раз, пока не пришло событие контракта', async () => {
    const { service, blockchain } = makeService({ drafts: [{ registry_id: 1, version: 3 }], approvals: [] });
    await service.getEffectiveVersions('voskhod');
    await service.getEffectiveVersions('voskhod');
    expect(blockchain.getAllRows).toHaveBeenCalledTimes(2);

    service.onDraftChanged();
    await service.getEffectiveVersions('voskhod');
    expect(blockchain.getAllRows).toHaveBeenCalledTimes(3);

    service.onApproved();
    await service.getEffectiveVersions('voskhod');
    expect(blockchain.getAllRows).toHaveBeenCalledTimes(4);
  });

  it('приложение считается подключённым, когда все обязательные документы имеют утверждённую редакцию', async () => {
    const { service, declarations } = makeService({
      drafts: [{ registry_id: 1100, version: 2 }, { registry_id: 1102, version: 1 }],
      approvals: [{ registry_id: 1100, version: 1, decision_id: 5 }, { registry_id: 1102, version: 1, decision_id: 6 }],
    });
    await declarations.registerDocuments([
      { extension_name: 'market', registry_id: 1100, kind: 'provision', approval: 'required', order: 10 },
      { extension_name: 'market', registry_id: 1102, kind: 'agreement', approval: 'required', order: 20 },
      { extension_name: 'market', registry_id: 1107, kind: 'service', approval: 'none', order: 90 },
    ]);
    expect(await service.isExtensionApproved('voskhod', 'market')).toBe(true);

    const other = makeService({ drafts: [{ registry_id: 1100, version: 2 }], approvals: [] });
    await other.declarations.registerDocuments([
      { extension_name: 'market', registry_id: 1100, kind: 'provision', approval: 'required', order: 10 },
    ]);
    expect(await other.service.isExtensionApproved('voskhod', 'market')).toBe(false);
  });
});
