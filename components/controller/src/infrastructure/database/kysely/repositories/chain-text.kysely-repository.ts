import { Inject, Injectable } from '@nestjs/common';
import type { ChainTextRepository } from '~/domain/chain-text/chain-text.repository';
import { KYSELY, type Database } from '../kysely.tokens';

/** Тексты, которые в цепи лежат хешем: ключ — sha256 текста (таблица `chain_texts`). */
@Injectable()
export class ChainTextKyselyRepository implements ChainTextRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async saveMany(entries: { digest: string; text: string }[]): Promise<void> {
    if (entries.length === 0) return;
    await this.db
      .insertInto('chain_texts')
      .values(entries.map(({ digest, text }) => ({ digest, text })))
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  async findByDigests(digests: string[]): Promise<Map<string, string>> {
    if (digests.length === 0) return new Map();
    const rows = await this.db.selectFrom('chain_texts').select(['digest', 'text']).where('digest', 'in', digests).execute();
    return new Map(rows.map((row) => [row.digest, row.text]));
  }
}
