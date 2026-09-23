import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ChainTextRepository } from '~/domain/chain-text/chain-text.repository';
import { ChainTextEntity } from '../entities/chain-text.entity';

@Injectable()
export class TypeOrmChainTextRepository implements ChainTextRepository {
  constructor(
    @InjectRepository(ChainTextEntity)
    private readonly repository: Repository<ChainTextEntity>
  ) {}

  async saveMany(entries: { digest: string; text: string }[]): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ChainTextEntity)
      .values(entries.map(({ digest, text }) => ({ digest, text })))
      .orIgnore()
      .execute();
  }

  async findByDigests(digests: string[]): Promise<Map<string, string>> {
    if (digests.length === 0) return new Map();
    const rows = await this.repository.find({ where: { digest: In(digests) } });
    return new Map(rows.map((row) => [row.digest, row.text]));
  }
}
