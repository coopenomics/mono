import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { DocumentDeclarationsRegistryService } from '~/domain/document-approval/services/document-declarations-registry.service';
import {
  CORE_DOCUMENT_DECLARATIONS,
  CORE_DOCUMENTS_OWNER,
  coreDocumentDeclarationsFor,
} from '~/domain/document-approval/constants/core-document-declarations';
import { Registry } from '@coopenomics/docs-templates';

const R = Registry;

jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() } as any;

const decl = (extension_name: string, registry_id: number, order = 10, extra: Partial<InnerDocumentDeclaration> = {}): InnerDocumentDeclaration => ({
  extension_name,
  registry_id,
  kind: 'form',
  approval: 'required',
  order,
  ...extra,
});

describe('DocumentDeclarationsRegistryService', () => {
  let registry: DocumentDeclarationsRegistryService;

  // Ведущего сети реестр читает из цепи; в этом наборе узел — узел ведущего.
  const chain = { getNetworkLead: jest.fn(async () => 'voskhod') } as any;

  beforeEach(() => {
    chain.getNetworkLead.mockReset().mockResolvedValue('voskhod');
    registry = new DocumentDeclarationsRegistryService(logger, chain);
  });

  it('при старте объявляет базовый набор ядра', async () => {
    await registry.onModuleInit();
    const core = registry.getByExtension(CORE_DOCUMENTS_OWNER);
    expect(core.length).toBe(CORE_DOCUMENT_DECLARATIONS.length);
    expect(registry.getByRegistryId(R.PrivacyPolicy.registry_id)?.vars_field).toBe('privacy_agreement');
    expect(registry.getByRegistryId(R.FreeDecision.registry_id)?.approval).toBe('none');
  });

  it('документы расширения появляются после регистрации и исчезают при остановке', async () => {
    await registry.registerDocuments([decl('market', R.MarketplaceOffer.registry_id, 20), decl('market', R.MarketplaceProgramTemplate.registry_id, 10)]);
    expect(registry.getByExtension('market').map((d) => d.registry_id)).toEqual([R.MarketplaceProgramTemplate.registry_id, R.MarketplaceOffer.registry_id]);

    await registry.onExtensionTerminate({ appName: 'market' } as any);
    expect(registry.getByExtension('market')).toEqual([]);
    expect(registry.getByRegistryId(R.MarketplaceOffer.registry_id)).toBeNull();
  });

  it('повторное объявление того же шаблона тем же расширением заменяет запись без дублей', async () => {
    await registry.registerDocuments([decl('capital', R.BlagorostOffer.registry_id, 10, { kind: 'agreement' })]);
    await registry.registerDocuments([decl('capital', R.BlagorostOffer.registry_id, 50, { kind: 'agreement', bundle: 'blagorost_offer_template' })]);
    const all = registry.getByExtension('capital');
    expect(all).toHaveLength(1);
    expect(all[0]?.order).toBe(50);
    expect(all[0]?.bundle).toBe('blagorost_offer_template');
  });

  it('один шаблон двум расширениям принадлежать не может', async () => {
    await registry.registerDocuments([decl('capital', R.BlagorostOffer.registry_id)]);
    await expect(registry.registerDocuments([decl('market', R.BlagorostOffer.registry_id)])).rejects.toThrow(/уже объявлен расширением capital/);
  });

  it('базовый набор ядра не снимается остановкой расширения', async () => {
    await registry.onModuleInit();
    await registry.unregisterByExtension(CORE_DOCUMENTS_OWNER);
    expect(registry.getByExtension(CORE_DOCUMENTS_OWNER).length).toBe(CORE_DOCUMENT_DECLARATIONS.length);
  });

  it('getAll отдаёт ядро первым, затем расширения по имени и порядку', async () => {
    await registry.onModuleInit();
    await registry.registerDocuments([decl('market', R.MarketplaceOffer.registry_id, 20), decl('capital', R.BlagorostOffer.registry_id, 10)]);
    const owners = registry.getAll().map((d) => d.extension_name);
    expect(owners[0]).toBe(CORE_DOCUMENTS_OWNER);
    expect(owners.indexOf('capital')).toBeLessThan(owners.indexOf('market'));
  });

  it('getByBundle собирает пакет одного решения', async () => {
    await registry.onModuleInit();
    const forms = registry.getByBundle(CORE_DOCUMENTS_OWNER, 'participant_application').map((d) => d.registry_id);
    expect(forms).toEqual([R.ParticipantApplication.registry_id, R.SelectBranchStatement.registry_id]);
  });

  it('оферту о присоединении к платформе объявляет только ведущий сети', () => {
    const offer = Registry.CoopenomicsAgreement.registry_id;
    expect(coreDocumentDeclarationsFor('voskhod', 'voskhod').some((d) => d.registry_id === offer)).toBe(true);
    expect(coreDocumentDeclarationsFor('sosedi', 'voskhod').some((d) => d.registry_id === offer)).toBe(false);
    expect(coreDocumentDeclarationsFor('sosedi', 'voskhod')).toHaveLength(CORE_DOCUMENT_DECLARATIONS.length - 1);
  });

  // 28.11.2026: ведущего сети называет цепь (реестр, строка network), а не имя в коде.
  it('side: ведущий сети в цепи — другой кооператив: оферту объявляет он, voskhod её теряет', () => {
    const offer = Registry.CoopenomicsAgreement.registry_id;
    expect(coreDocumentDeclarationsFor('hubcoop', 'hubcoop').some((d) => d.registry_id === offer)).toBe(true);
    expect(coreDocumentDeclarationsFor('voskhod', 'hubcoop').some((d) => d.registry_id === offer)).toBe(false);
  });

  it('side: узел кооператива при ведущем-другом стартует без оферты о присоединении', async () => {
    chain.getNetworkLead.mockResolvedValue('hubcoop');
    await registry.onModuleInit();
    expect(registry.getByRegistryId(Registry.CoopenomicsAgreement.registry_id)).toBeNull();
  });

  it('break: цепь при старте не ответила — реестр поднимается с ведущим по умолчанию', async () => {
    chain.getNetworkLead.mockRejectedValue(new Error('chain down'));
    await registry.onModuleInit();
    expect(registry.getByRegistryId(Registry.CoopenomicsAgreement.registry_id)).not.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });
});
