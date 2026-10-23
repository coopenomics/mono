import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { ORCHESTRATOR_DB } from '../database/database.module';
import type { OrchestratorDB } from '../database/database.types';

export interface SubgraphDescriptor {
  name: string;
  url: string;
}

/**
 * packageId из каталога (`@scope/name`, `core@coopback`) содержит символы,
 * недопустимые в имени subgraph'а для Apollo composition (имя попадает в
 * enum `join__Graph` supergraph-SDL). Приводим к `[a-zA-Z][a-zA-Z0-9_-]*`.
 */
export function toSubgraphName(packageId: string): string {
  const cleaned = packageId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-zA-Z]/.test(cleaned) ? cleaned : `s-${cleaned}`;
}

/**
 * Чтение/запись регистра subgraph'ов. Используется и Apollo Gateway'ем
 * (для compose), и orchestrator REST-эндпоинтами (install/uninstall/refresh).
 */
@Injectable()
export class SubgraphRegistryService {
  constructor(@Inject(ORCHESTRATOR_DB) private readonly db: Kysely<OrchestratorDB>) {}

  /**
   * Список active subgraph'ов в формате который ждёт Apollo Gateway's
   * IntrospectAndCompose. На bootstrap'е orchestrator'а должна быть как
   * минимум одна запись (core), иначе gateway не скомпонует ничего.
   */
  async listForCompose(): Promise<SubgraphDescriptor[]> {
    const rows = await this.db
      .selectFrom('subgraph_registry')
      .select(['package_id', 'url'])
      .where('active', '=', true)
      .orderBy('created_at')
      .execute();
    const seen = new Map<string, number>();
    return rows.map((r) => {
      let name = toSubgraphName(r.package_id);
      const dup = seen.get(name) ?? 0;
      seen.set(name, dup + 1);
      if (dup > 0) name = `${name}-${dup + 1}`;
      return { name, url: r.url };
    });
  }

  async upsert(packageId: string, version: string, url: string): Promise<void> {
    await upsertSubgraph(this.db, packageId, version, url);
  }

  async deactivate(packageId: string): Promise<void> {
    await this.db
      .updateTable('subgraph_registry')
      .set({ active: false, updated_at: new Date() })
      .where('package_id', '=', packageId)
      .execute();
  }

  async setHealthStatus(packageId: string, healthStatus: string): Promise<void> {
    await this.db
      .updateTable('subgraph_registry')
      .set({ health_status: healthStatus, updated_at: new Date() })
      .where('package_id', '=', packageId)
      .execute();
  }
}

/**
 * Записать субграф активным; повторная запись того же пакета обновляет
 * версию и адрес. Нужна и сервису, и стартовому засеву ядра в `main.ts`.
 */
export async function upsertSubgraph(
  db: Kysely<OrchestratorDB>,
  packageId: string,
  version: string,
  url: string,
): Promise<void> {
  await db
    .insertInto('subgraph_registry')
    .values({ package_id: packageId, version, url, active: true, health_status: 'unknown' })
    .onConflict((oc) =>
      oc.column('package_id').doUpdateSet({
        version,
        url,
        active: true,
        health_status: 'unknown',
        updated_at: new Date(),
      }),
    )
    .execute();
}
