import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DraftContract } from 'cooptypes';
import config from '~/config/config';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { TypeOrmDraftRegistryRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-draft-registry.repository';

/** Сколько живёт снимок утверждений кооператива без события контракта. */
const APPROVALS_CACHE_TTL_MS = 60_000;

interface ApprovalVersion {
  registry_id: number;
  version: number;
}

/**
 * На каком блоке брать текст шаблона для документов кооператива.
 *
 * Пока совет не утвердил новую редакцию, пайщикам предъявляется утверждённая:
 * её текст берётся из реестра шаблонов узла на последнем блоке, где эта
 * редакция ещё была текущей в сети. Так до кооператива доезжают правки без
 * смены номера (опечатки, вёрстка), сделанные в утверждённой редакции, а
 * смысловые изменения новой редакции — нет.
 *
 * Возвращает `undefined`, когда читать нужно текущее состояние: утверждения нет
 * (переходный режим до миграции), утверждённая редакция совпадает с сетевой
 * или история версии в реестре узла отсутствует. В последнем случае лучше
 * показать текущий текст, чем упасть: расхождение остаётся видимым в реестре
 * шаблонов как состояние «устарело».
 */
@Injectable()
export class EffectiveTemplateBlockResolver {
  private approvals: { value: Map<number, ApprovalVersion>; expires_at: number } | null = null;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly draftRegistry: TypeOrmDraftRegistryRepository
  ) {}

  async resolve(registryId: string | number): Promise<number | undefined> {
    const registry_id = Number(registryId);
    const approval = (await this.loadApprovals()).get(registry_id);
    if (!approval) return undefined;

    const current = await this.draftRegistry.findTemplateAt(registry_id);
    const currentVersion = current ? Number(current.version) : null;
    if (currentVersion === null || approval.version >= currentVersion) return undefined;

    const block = await this.draftRegistry.findLastBlockOfVersion(registry_id, approval.version);
    return block ?? undefined;
  }

  private async loadApprovals(): Promise<Map<number, ApprovalVersion>> {
    if (this.approvals && this.approvals.expires_at > Date.now()) return this.approvals.value;

    const rows = await this.blockchainService.getAllRows(
      DraftContract.contractName.production,
      config.coopname,
      DraftContract.Tables.Approvals.tableName
    );
    const map = new Map<number, ApprovalVersion>();
    for (const row of rows) {
      map.set(Number(row.registry_id), { registry_id: Number(row.registry_id), version: Number(row.version) });
    }
    this.approvals = { value: map, expires_at: Date.now() + APPROVALS_CACHE_TTL_MS };
    return map;
  }

  @OnEvent(`action::${DraftContract.contractName.production}::${DraftContract.Actions.Approve.actionName}`)
  onApproved(): void {
    this.approvals = null;
  }
}
