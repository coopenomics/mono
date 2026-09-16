import type { InnerDocumentDeclaration } from '@coopenomics/innercoop';
import { DocumentDeclarationsRegistryService } from '~/domain/document-approval/services/document-declarations-registry.service';
import {
  CORE_DOCUMENT_DECLARATIONS,
  CORE_DOCUMENTS_OWNER,
  coreDocumentDeclarationsFor,
} from '~/domain/document-approval/constants/core-document-declarations';
import { Cooperative } from 'cooptypes';

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

  beforeEach(() => {
    registry = new DocumentDeclarationsRegistryService(logger);
  });

  it('при старте объявляет базовый набор ядра', async () => {
    await registry.onModuleInit();
    const core = registry.getByExtension(CORE_DOCUMENTS_OWNER);
    expect(core.length).toBe(CORE_DOCUMENT_DECLARATIONS.length);
    expect(registry.getByRegistryId(3)?.vars_field).toBe('privacy_agreement');
    expect(registry.getByRegistryId(600)?.approval).toBe('none');
  });

  it('документы расширения появляются после регистрации и исчезают при остановке', async () => {
    await registry.registerDocuments([decl('market', 1102, 20), decl('market', 1100, 10)]);
    expect(registry.getByExtension('market').map((d) => d.registry_id)).toEqual([1100, 1102]);

    await registry.onExtensionTerminate({ appName: 'market' } as any);
    expect(registry.getByExtension('market')).toEqual([]);
    expect(registry.getByRegistryId(1102)).toBeNull();
  });

  it('повторное объявление того же шаблона тем же расширением заменяет запись без дублей', async () => {
    await registry.registerDocuments([decl('capital', 1000, 10, { kind: 'agreement' })]);
    await registry.registerDocuments([decl('capital', 1000, 50, { kind: 'agreement', bundle: 'blagorost_offer_template' })]);
    const all = registry.getByExtension('capital');
    expect(all).toHaveLength(1);
    expect(all[0]?.order).toBe(50);
    expect(all[0]?.bundle).toBe('blagorost_offer_template');
  });

  it('один шаблон двум расширениям принадлежать не может', async () => {
    await registry.registerDocuments([decl('capital', 1000)]);
    await expect(registry.registerDocuments([decl('market', 1000)])).rejects.toThrow(/уже объявлен расширением capital/);
  });

  it('базовый набор ядра не снимается остановкой расширения', async () => {
    await registry.onModuleInit();
    await registry.unregisterByExtension(CORE_DOCUMENTS_OWNER);
    expect(registry.getByExtension(CORE_DOCUMENTS_OWNER).length).toBe(CORE_DOCUMENT_DECLARATIONS.length);
  });

  it('getAll отдаёт ядро первым, затем расширения по имени и порядку', async () => {
    await registry.onModuleInit();
    await registry.registerDocuments([decl('market', 1102, 20), decl('capital', 1000, 10)]);
    const owners = registry.getAll().map((d) => d.extension_name);
    expect(owners[0]).toBe(CORE_DOCUMENTS_OWNER);
    expect(owners.indexOf('capital')).toBeLessThan(owners.indexOf('market'));
  });

  it('getByBundle собирает пакет одного решения', async () => {
    await registry.onModuleInit();
    const forms = registry.getByBundle(CORE_DOCUMENTS_OWNER, 'participant_application').map((d) => d.registry_id);
    expect(forms).toEqual([100, 101]);
  });

  it('оферту о присоединении к платформе объявляет только оператор платформы', () => {
    const offer = Cooperative.Registry.CoopenomicsAgreement.registry_id;
    expect(coreDocumentDeclarationsFor('voskhod').some((d) => d.registry_id === offer)).toBe(true);
    expect(coreDocumentDeclarationsFor('sosedi').some((d) => d.registry_id === offer)).toBe(false);
    expect(coreDocumentDeclarationsFor('sosedi')).toHaveLength(CORE_DOCUMENT_DECLARATIONS.length - 1);
  });
});
