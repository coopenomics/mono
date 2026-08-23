// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import type { DocumentRepository } from '~/domain/document/repository/document.repository';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';

@Injectable()
export class DocumentRepositoryImplementation implements DocumentRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async findByHash(hash: string | null, block_num?: number): Promise<DocumentDomainEntity | null> {
    if (!hash) return null;
    const normalized = hash.toUpperCase();

    // Точная версия черновика по (hash + meta.block_num): нужна второму
    // подписанту, чтобы получить ровно ту версию, которую подписал первый
    // (черновики версионируются — см. saveDraft в фабрике).
    if (block_num !== undefined && block_num !== null) {
      const exact = await this.generatorPort.getDocument({ hash: normalized, block_num });
      if (exact) return new DocumentDomainEntity(exact);
      // Фолбэк: легаси-черновики, сохранённые до версионирования (без
      // совпадения по block_num), — берём по одному hash.
    }

    const document = await this.generatorPort.getDocument({ hash: normalized });
    if (document) return new DocumentDomainEntity(document);
    return null;
  }
}
