import { createHash } from 'crypto';
import { ChainTextService } from '../../../src/domain/chain-text/chain-text.service';
import type { ChainTextRepository } from '../../../src/domain/chain-text/chain-text.repository';

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Хранилище в памяти: тот же контракт, что у таблицы chain_texts. */
function memoryRepository(): ChainTextRepository & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async saveMany(entries) {
      for (const { digest, text } of entries) if (!store.has(digest)) store.set(digest, text);
    },
    async findByDigests(digests) {
      return new Map(digests.filter((d) => store.has(d)).map((d) => [d, store.get(d) as string]));
    },
  };
}

describe('ChainTextService — тексты, которые в цепи лежат хешем', () => {
  it('toChain сохраняет тексты и возвращает их sha256 в том же порядке, пустой текст — пустая строка', async () => {
    const repository = memoryRepository();
    const service = new ChainTextService(repository);

    const digests = await service.toChain(['Утвердить отчёт', '', 'Избрать совет']);

    expect(digests).toEqual([sha('Утвердить отчёт'), '', sha('Избрать совет')]);
    expect(repository.store.get(sha('Утвердить отчёт'))).toBe('Утвердить отчёт');
    expect(repository.store.size).toBe(2);
  });

  it('resolveFields подставляет тексты вместо хешей только в указанных полях', async () => {
    const repository = memoryRepository();
    const service = new ChainTextService(repository);
    await service.toChain(['Утвердить отчёт', 'Утвердить']);

    const [row] = await service.resolveFields(
      [{ id: 1, title: sha('Утвердить отчёт'), context: '', decision: sha('Утвердить'), hash: sha('Утвердить') }],
      ['title', 'context', 'decision'] as const
    );

    expect(row).toEqual({
      id: 1,
      title: 'Утвердить отчёт',
      context: '',
      decision: 'Утвердить',
      hash: sha('Утвердить'),
    });
  });

  it('текст из строки прежней версии проходит как есть, неизвестный хеш остаётся хешем', async () => {
    const service = new ChainTextService(memoryRepository());
    const unknown = sha('текст мимо контроллера');

    const [row] = await service.resolveFields([{ title: 'Старый текст в цепи', decision: unknown }], [
      'title',
      'decision',
    ] as const);

    expect(row).toEqual({ title: 'Старый текст в цепи', decision: unknown });
  });
});
