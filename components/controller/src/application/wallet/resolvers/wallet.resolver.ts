import { Resolver, Mutation, Query, Args, Subscription } from '@nestjs/graphql';
import { ForbiddenException, Inject, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard, RolesGuard, ActiveUserStatusGuard, AuthRoles, CurrentUser, createPaginationResult, PaginationResult, PaginationInputDTO, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { WalletService } from '../services/wallet.service';
import { ReturnByMoneyGenerateDocumentInputDTO } from '~/application/document/documents-dto/return-by-money-statement.dto';
import { ReturnByMoneyDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/return-by-money-decision.dto';
import { CreateWithdrawInputDTO } from '../dto/create-withdraw-input.dto';
import { CreateWithdrawResponseDTO } from '../dto/create-withdraw-response.dto';
import { CreateDepositPaymentInputDTO } from '../../gateway/dto/create-deposit-payment-input.dto';
import { GatewayPaymentDTO } from '../../gateway/dto/gateway-payment.dto';
import { ProgramWalletDTO } from '../dto/program-wallet.dto';
import { ProgramWalletFilterInputDTO } from '../dto/program-wallet-filter-input.dto';
import { UserWalletDTO } from '../dto/user-wallet.dto';
import { WalletChangedEventDTO, WalletEventsInputDTO } from '../dto/wallet-event.dto';
import { walletEventsTopic } from '../services/wallet-events.service';
import type { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import config from '~/config/config';
// Пагинированные результаты для программных кошельков
const paginatedProgramWalletsResult = createPaginationResult(ProgramWalletDTO, 'ProgramWallets');

/**
 * GraphQL резолвер для wallet
 * Обеспечивает API для управления паевыми взносами, их возвратами, генерацией документов и работой с программными кошельками
 */
@Resolver()
export class WalletResolver {
  constructor(
    private readonly walletService: WalletService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub
  ) {}

  /**
   * Поток изменений кошельков пайщика: сигнал приходит с дельтой цепи, клиент
   * по нему дочитывает остаток. Топик персональный и выводится из токена
   * соединения — чужой кошелёк подписчику не отдаётся, аргумент `coopname`
   * только сверяется с кооперативом узла.
   */
  @Subscription(() => WalletChangedEventDTO, {
    name: 'walletEvents',
    description: 'Изменения кошельков пайщика: сигнал к дочитке остатка.',
    resolve: (payload: { walletEvents: WalletChangedEventDTO }) => payload.walletEvents,
  })
  walletEvents(
    @CurrentUser() user: { username?: string },
    @Args('input') input: WalletEventsInputDTO
  ): AsyncIterator<{ walletEvents: WalletChangedEventDTO }> {
    if (input.coopname !== config.coopname) {
      throw new ForbiddenException('Подписка доступна только в рамках своего кооператива.');
    }
    const username = user?.username;
    if (!username) {
      throw new ForbiddenException('Подписка доступна только пайщику своего кооператива.');
    }
    return this.pubSub.asyncIterator(walletEventsTopic(config.coopname, username));
  }

  /**
   * Mutation: Генерация документа заявления на возврат паевого взноса (900)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateReturnByMoneyStatementDocument',
    description: 'Сгенерировать документ заявления на возврат паевого взноса',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateReturnByMoneyStatementDocument(
    @Args('data', { type: () => ReturnByMoneyGenerateDocumentInputDTO })
    data: ReturnByMoneyGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.walletService.generateReturnByMoneyStatementDocument(data, options);
  }

  /**
   * Mutation: Генерация документа решения совета о возврате паевого взноса (901)
   */
  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateReturnByMoneyDecisionDocument',
    description: 'Сгенерировать документ решения совета о возврате паевого взноса',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateReturnByMoneyDecisionDocument(
    @Args('data', { type: () => ReturnByMoneyDecisionGenerateDocumentInputDTO })
    data: ReturnByMoneyDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.walletService.generateReturnByMoneyDecisionDocument(data, options);
  }

  /**
   * Mutation: Создание заявки на вывод средств
   */
  @Mutation(() => CreateWithdrawResponseDTO, {
    name: 'createWithdraw',
    description: 'Создать заявку на вывод средств',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createWithdraw(@Args('data') input: CreateWithdrawInputDTO): Promise<CreateWithdrawResponseDTO> {
    return this.walletService.createWithdraw(input);
  }

  /**
   * Mutation: Создать депозитный платеж
   */
  @Mutation(() => GatewayPaymentDTO, {
    name: 'createDepositPayment',
    description:
      'Создание объекта паевого платежа производится мутацией createDepositPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard, ActiveUserStatusGuard)
  @AuthRoles(['chairman', 'member'])
  async createDepositPayment(
    @Args('data', { type: () => CreateDepositPaymentInputDTO }) data: CreateDepositPaymentInputDTO
  ): Promise<GatewayPaymentDTO> {
    return await this.walletService.createDepositPayment(data);
  }

  /**
   * Query: Получить программные кошельки с пагинацией
   */
  @Query(() => paginatedProgramWalletsResult, {
    name: 'getProgramWallets',
    description: 'Получить список программных кошельков с фильтрацией и пагинацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getProgramWallets(
    @Args('filter', { nullable: true }) filter?: ProgramWalletFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramWalletDTO>> {
    return await this.walletService.getProgramWalletsPaginated(filter, options);
  }

  /**
   * Query: Получить один программный кошелек
   */
  @Query(() => ProgramWalletDTO, {
    name: 'getProgramWallet',
    description: 'Получить один программный кошелек по фильтру',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getProgramWallet(@Args('filter') filter: ProgramWalletFilterInputDTO): Promise<ProgramWalletDTO | null> {
    return await this.walletService.getProgramWallet(filter);
  }

  /**
   * Query: Кошельки пайщика без сворачивания (каждый кошелёк отдельной строкой)
   */
  @Query(() => [UserWalletDTO], {
    name: 'getUserWallets',
    description: 'Кошельки пайщика — каждый кошелёк отдельной строкой, без объединения паевого и членского',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getUserWallets(
    @Args('username') username: string,
    @Args('coopname', { nullable: true }) coopname?: string
  ): Promise<UserWalletDTO[]> {
    return await this.walletService.getUserWallets(username, coopname);
  }
}
