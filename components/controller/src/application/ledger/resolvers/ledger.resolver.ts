import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '@coopenomics/extension-kit';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { RolesGuard } from '@coopenomics/extension-kit';
import { LedgerService } from '../services/ledger.service';
import { GetLedgerInputDTO } from '../dto/get-ledger-input.dto';
import { GetLedgerHistoryInputDTO } from '../dto/get-ledger-history-input.dto';
import { LedgerStateDTO } from '../dto/ledger-state.dto';
import { LedgerHistoryResponseDTO } from '../dto/ledger-operation.dto';

/**
 * GraphQL резолвер для ledger
 * Обеспечивает API для получения состояния плана счетов кооператива
 */
@Resolver()
export class LedgerResolver {
  constructor(private readonly ledgerService: LedgerService) {}

  /**
   * Query: Получить состояние ledger кооператива
   */
  @Query(() => LedgerStateDTO, {
    name: 'getLedger',
    description:
      'Получить полное состояние плана счетов кооператива. Возвращает все счета из стандартного плана счетов с актуальными данными из блокчейна. Если счет не активен в блокчейне, возвращает нулевые значения.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getLedger(
    @Args('data', { type: () => GetLedgerInputDTO })
    data: GetLedgerInputDTO
  ): Promise<LedgerStateDTO> {
    return this.ledgerService.getLedger(data);
  }

  /**
   * Query: Получить историю операций ledger кооператива
   */
  @Query(() => LedgerHistoryResponseDTO, {
    name: 'getLedgerHistory',
    description:
      'Получить историю операций по счетам кооператива. Возвращает список операций с возможностью фильтрации по account_id и пагинацией. Операции сортируются по дате создания (новые первыми).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getLedgerHistory(
    @Args('data', { type: () => GetLedgerHistoryInputDTO })
    data: GetLedgerHistoryInputDTO
  ): Promise<LedgerHistoryResponseDTO> {
    return this.ledgerService.getLedgerHistory(data);
  }
}
