/**
 * Кто собирает документ на чужое имя.
 *
 * Документ генерируется на себя (правка 17.09.2026: иначе пайщик собирал бы
 * документы на чужое имя). Исключение — протокол решения совета: его
 * председатель и члены совета собирают на имя заявителя. Без исключения
 * рабочий стол не мог вручную утвердить ни одно решение по чужому заявлению —
 * например, материальную помощь доверенному участка (нашёл внешний слой).
 */
import { Cooperative } from 'cooptypes';
import { DocumentResolver } from '~/application/document/resolvers/document.resolver';

const AID_PROTOCOL = Cooperative.Document.decisionTypesRegistry.brnaid.protocol_registry_id;

function makeResolver() {
  const documentService = { generateAnyDocument: jest.fn(async () => ({ hash: 'doc' })) } as any;
  return { resolver: new DocumentResolver(documentService, {} as any), documentService };
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e: any) {
    return e.code ?? null;
  }
}

describe('generateDocument — на себя и протокол решения совета', () => {
  it('председатель собирает протокол решения на имя заявителя', async () => {
    const { resolver, documentService } = makeResolver();
    const input = { data: { registry_id: AID_PROTOCOL, username: 'chairkrg' } };
    await expect(resolver.generateDocument(input as any, { username: 'ant', role: 'chairman' } as any)).resolves.toBeTruthy();
    expect(documentService.generateAnyDocument).toHaveBeenCalledWith(input);
  });

  it('член совета — тоже; пайщик — нет', async () => {
    const input = { data: { registry_id: AID_PROTOCOL, username: 'chairkrg' } };
    expect(await codeOf(makeResolver().resolver.generateDocument(input as any, { username: 'petr', role: 'member' } as any))).toBeNull();
    expect(await codeOf(makeResolver().resolver.generateDocument(input as any, { username: 'ivanov', role: 'user' } as any)))
      .toBe('DOCUMENT_GENERATION_FORBIDDEN');
  });

  it('не протокол решения на чужое имя не собирает никто, даже председатель', async () => {
    const input = { data: { registry_id: 1109, username: 'chairkrg' } };
    expect(await codeOf(makeResolver().resolver.generateDocument(input as any, { username: 'ant', role: 'chairman' } as any)))
      .toBe('DOCUMENT_GENERATION_FORBIDDEN');
  });

  it('на себя — любой документ', async () => {
    const input = { data: { registry_id: 1109, username: 'ivanov' } };
    expect(await codeOf(makeResolver().resolver.generateDocument(input as any, { username: 'ivanov', role: 'user' } as any))).toBeNull();
  });
});
