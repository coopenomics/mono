import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubgraphRegistryEntity } from './subgraph-registry.entity';

export interface SubgraphDescriptor {
  name: string;
  url: string;
}

/**
 * Чтение/запись регистра subgraph'ов. Используется и Apollo Gateway'ем
 * (для compose), и orchestrator REST-эндпоинтами (install/uninstall/refresh).
 */
@Injectable()
export class SubgraphRegistryService {
  constructor(
    @InjectRepository(SubgraphRegistryEntity)
    private readonly repo: Repository<SubgraphRegistryEntity>,
  ) {}

  /**
   * Список active subgraph'ов в формате который ждёт Apollo Gateway's
   * IntrospectAndCompose. На bootstrap'е orchestrator'а должна быть как
   * минимум одна запись (core), иначе gateway не скомпонует ничего.
   */
  async listForCompose(): Promise<SubgraphDescriptor[]> {
    const rows = await this.repo.find({ where: { active: true } });
    return rows.map((r) => ({ name: r.packageId, url: r.url }));
  }

  async upsert(packageId: string, version: string, url: string): Promise<void> {
    await this.repo.upsert(
      {
        packageId,
        version,
        url,
        active: true,
        healthStatus: 'unknown',
      },
      ['packageId'],
    );
  }

  async deactivate(packageId: string): Promise<void> {
    await this.repo.update({ packageId }, { active: false });
  }

  async setHealthStatus(packageId: string, healthStatus: string): Promise<void> {
    await this.repo.update({ packageId }, { healthStatus });
  }
}
