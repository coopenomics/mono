/**
 * Исходник документа для второго подписанта ищется по meta подписанного
 * документа. Две заявки одного пайщика в доверенные за минуту давали
 * одинаковое тело и блок; по одному хэшу находилась чужая версия, и встречная
 * подпись второй заявки падала «Хэш метаданных не совпадает» (C28-80).
 */
import { DocumentRepositoryImplementation } from '~/infrastructure/database/generator-repositories/repositories/document-generator.repository';

const doc = (hash: string, meta: Record<string, unknown>) => ({ hash, meta, full_title: 'Договор', html: '<p/>', binary: new Uint8Array(0) }) as any;

describe('версия документа по meta подписанного', () => {
  it('meta передана — берётся точная версия, а не первая с тем же телом', async () => {
    const first = doc('ABC', { hash: 'r1', block_num: 7 });
    const second = doc('ABC', { hash: 'r2', block_num: 7 });
    const port = {
      getDocument: jest.fn(async (q: any) => (q.meta ? (q.meta.hash === 'r2' ? second : null) : first)),
    };
    const repo = new DocumentRepositoryImplementation(port as any);

    const found = await repo.findByHash('abc', 7, { hash: 'r2', block_num: 7 });

    expect(found?.meta).toEqual(second.meta);
    expect(port.getDocument).toHaveBeenCalledWith({ hash: 'ABC', meta: { hash: 'r2', block_num: 7 } });
  });

  it('точной версии нет (черновик до ключа по meta) — прежний поиск по блоку и по хэшу', async () => {
    const legacy = doc('ABC', { hash: 'r1', block_num: 7 });
    const port = { getDocument: jest.fn(async (q: any) => (q.meta ? null : legacy)) };
    const repo = new DocumentRepositoryImplementation(port as any);

    expect((await repo.findByHash('abc', 7, { hash: 'r1', block_num: 7 }))?.meta).toEqual(legacy.meta);
    expect(port.getDocument).toHaveBeenLastCalledWith({ hash: 'ABC', block_num: 7 });
  });
});
