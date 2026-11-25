import { Inject, Injectable } from '@nestjs/common';
import { LEDGER2_HISTORY_PORT, type ILedger2HistoryPort } from '@coopenomics/innercoop';
import { platformSettings, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import { CONTRIBUTION_KIND_BY_OPERATION } from '../../domain/enums/contribution-kind.enum';
import type { ContributionOutputDTO } from '../dto/contributions/contribution.dto';

/**
 * История паевых взносов пайщика в программы Благороста — одна лента для
 * денег, имущества и результатов. Источник — книга учёта (ledger2): взнос
 * считается внесённым, когда по нему прошла операция, а не когда подано
 * заявление. Заявки в работе показывают свои списки (взносы имуществом,
 * результаты).
 */
@Injectable()
export class ContributionsHistoryService {
  constructor(@Inject(LEDGER2_HISTORY_PORT) private readonly ledger2History: ILedger2HistoryPort) {}

  async getContributions(username: string, options?: PaginationInputDTO): Promise<PaginationResult<ContributionOutputDTO>> {
    const result = await this.ledger2History.getHistory({
      coopname: platformSettings().coopname,
      username,
      actionNames: ['apply'],
      operationCodes: Object.keys(CONTRIBUTION_KIND_BY_OPERATION),
      page: options?.page ?? 1,
      limit: options?.limit ?? 20,
      sortOrder: options?.sortOrder ?? 'DESC',
    });

    return {
      items: result.items.map((op) => ({
        id: op.globalSequence,
        kind: CONTRIBUTION_KIND_BY_OPERATION[op.operationCode ?? ''],
        amount: op.quantity ?? '',
        created_at: op.createdAt.toISOString(),
        process_hash: op.processHash ?? null,
        memo: op.memo ?? null,
      })),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }
}
