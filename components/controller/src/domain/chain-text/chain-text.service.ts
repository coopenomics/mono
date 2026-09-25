import { Inject, Injectable, Logger } from '@nestjs/common';
import { chainTextDigest, isChainTextDigest } from '@coopenomics/extension-kit';
import { CHAIN_TEXT_REPOSITORY, type ChainTextRepository } from './chain-text.repository';

/**
 * Тексты, которые уходят в цепь хешем, и обратная подстановка текста вместо хеша.
 *
 * Перед отправкой в цепь текст сохраняется здесь и заменяется хешем (`toChain`).
 * При чтении строки цепи хеш заменяется текстом (`resolveFields`). Строки, записанные
 * до выноса текстов, несут сам текст — он проходит как есть.
 */
@Injectable()
export class ChainTextService {
  private readonly logger = new Logger(ChainTextService.name);

  constructor(@Inject(CHAIN_TEXT_REPOSITORY) private readonly repository: ChainTextRepository) {}

  /** Сохранить тексты и вернуть их хеши в том же порядке; пустой текст — пустая строка. */
  async toChain(texts: string[]): Promise<string[]> {
    const digests = texts.map((text) => chainTextDigest(text));
    const entries = texts
      .map((text, i) => ({ digest: digests[i], text }))
      .filter((entry) => entry.digest !== '');
    if (entries.length > 0) await this.repository.saveMany(entries);
    return digests;
  }

  /**
   * Подставить тексты вместо хешей в указанных полях. Хеш без текста в хранилище
   * остаётся хешем, и это пишется в журнал: значит, текст отправлен мимо контроллера.
   */
  async resolveFields<T extends object, K extends keyof T & string>(items: T[], fields: readonly K[]): Promise<T[]> {
    const digests = new Set<string>();
    for (const item of items) {
      for (const field of fields) {
        const value = item[field];
        if (typeof value === 'string' && isChainTextDigest(value)) digests.add(value.toLowerCase());
      }
    }
    if (digests.size === 0) return items;

    const texts = await this.repository.findByDigests([...digests]);
    const missing = [...digests].filter((digest) => !texts.has(digest));
    if (missing.length > 0) {
      this.logger.error(`Нет текста для ${missing.length} хешей из цепи: ${missing.slice(0, 5).join(', ')}`);
    }

    return items.map((item) => {
      const resolved = { ...item };
      for (const field of fields) {
        const value = item[field];
        const digest = typeof value === 'string' ? value.toLowerCase() : undefined;
        if (digest && texts.has(digest)) {
          (resolved as Record<string, unknown>)[field] = texts.get(digest);
        }
      }
      return resolved;
    });
  }
}
