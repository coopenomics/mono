import { Inject, Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  CPP_REGISTRY_REPOSITORY,
  type CppRegistryRepository,
} from '../repositories/cpp-registry.repository';
import { CppRegistryEntryDomainEntity } from '../entities/cpp-registry-entry.entity';

@Injectable()
export class CppRegistryDomainService {
  constructor(
    @Inject(CPP_REGISTRY_REPOSITORY) private readonly repository: CppRegistryRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(CppRegistryDomainService.name);
  }

  /**
   * Идемпотентный upsert записи реестра. `extensionName` — естественный ключ
   * (один template per extension в MVP); повторный вызов с тем же
   * `extensionName` обновит `template_document_registry_id`/`mvp_hardcoded`,
   * не создаёт дубликат.
   */
  async register(input: {
    template_document_registry_id: number;
    required_for_extension: string;
    mvp_hardcoded: boolean;
  }): Promise<CppRegistryEntryDomainEntity> {
    const entry = new CppRegistryEntryDomainEntity(input);
    const saved = await this.repository.upsertByExtension(entry);
    this.logger.info(
      `[CPP_REGISTRY] upsert ${input.required_for_extension} → template_document_registry_id=${input.template_document_registry_id} (mvp_hardcoded=${input.mvp_hardcoded})`
    );
    return saved;
  }

  async findByExtension(extensionName: string): Promise<CppRegistryEntryDomainEntity | null> {
    return this.repository.findByExtension(extensionName);
  }

  async findAll(): Promise<CppRegistryEntryDomainEntity[]> {
    return this.repository.findAll();
  }
}
