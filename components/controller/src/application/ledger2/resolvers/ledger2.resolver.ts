import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { Ledger2Service } from '../services/ledger2.service';
import { Ledger2AccountDTO } from '../dto/ledger2-account.dto';
import { Ledger2WalletDTO } from '../dto/ledger2-wallet.dto';
import { Ledger2HistoryResponseDTO } from '../dto/ledger2-operation.dto';
import { Ledger2PostingsResponseDTO } from '../dto/ledger2-posting.dto';
import { GetLedger2HistoryInputDTO } from '../dto/get-ledger2-history-input.dto';
import { GetLedger2PostingsInputDTO } from '../dto/get-ledger2-postings-input.dto';
import { WalmoveInputDTO } from '../dto/walmove-input.dto';
import { Ledger2AdjustmentResultDTO } from '../dto/ledger2-adjustment-result.dto';

/**
 * GraphQL фасад для ledger2. Единая точка для рабочего стола reports:
 * - AccountsPage использует getLedger2Accounts;
 * - WalletsPage использует getLedger2Wallets;
 * - OperationsPage использует getLedger2History;
 * - корректировки председателя — мутации walmoveWallets / revertOperation
 *   (роль `chairman` обязательна; member-роль не разрешает писать).
 */
@Resolver()
export class Ledger2Resolver {
  constructor(private readonly service: Ledger2Service) {}

  @Query(() => [Ledger2AccountDTO], {
    name: 'getLedger2Accounts',
    description:
      'Актуальные балансы счетов кооператива из ledger2::accounts (id ×1000).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  getLedger2Accounts(
    @Args('coopname', { type: () => String }) coopname: string,
  ): Promise<Ledger2AccountDTO[]> {
    return this.service.getAccounts(coopname);
  }

  @Query(() => [Ledger2WalletDTO], {
    name: 'getLedger2Wallets',
    description:
      'Общекооперативные кошельки из ledger2::wallets (eosio::name w.<contract>.<waltype>). ' +
      'Кошельки пайщиков живут в контракте soviet — сюда не попадают.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  getLedger2Wallets(
    @Args('coopname', { type: () => String }) coopname: string,
  ): Promise<Ledger2WalletDTO[]> {
    return this.service.getWallets(coopname);
  }

  @Query(() => Ledger2HistoryResponseDTO, {
    name: 'getLedger2History',
    description:
      'История операций ledger2 с серверными фильтрами (action/accountId/username/date-range).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  getLedger2History(
    @Args('input', { type: () => GetLedger2HistoryInputDTO }) input: GetLedger2HistoryInputDTO,
  ): Promise<Ledger2HistoryResponseDTO> {
    return this.service.getHistory(input);
  }

  @Query(() => Ledger2PostingsResponseDTO, {
    name: 'getLedger2Postings',
    description:
      'Реестр проводок: пары debit+credit (Дт/Кт/Сумма), восстановленные из blockchain_actions ' +
      'по правилу «ближайший parent apply». Источник для фронт-страницы «Реестр проводок».',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  getLedger2Postings(
    @Args('input', { type: () => GetLedger2PostingsInputDTO }) input: GetLedger2PostingsInputDTO,
  ): Promise<Ledger2PostingsResponseDTO> {
    return this.service.getPostings(input);
  }

  @Mutation(() => Ledger2AdjustmentResultDTO, {
    name: 'walmoveWallets',
    description:
      'Перевод между кошельками одного бух.счёта (operation o.adj.walmove). ' +
      'Только председатель. Backend проверяет связь wallet→account до подписания.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  walmoveWallets(
    @Args('input', { type: () => WalmoveInputDTO }) input: WalmoveInputDTO,
  ): Promise<Ledger2AdjustmentResultDTO> {
    return this.service.walmove(input);
  }
}
