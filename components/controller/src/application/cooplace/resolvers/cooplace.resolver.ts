import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { Throttle } from '@nestjs/throttler';
import { CooplaceService } from '../services/cooplace.service';
import { AssetContributionStatementGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-statement-document.dto';
import { AssetContributionDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-decision-document.dto';
import { AssetContributionActGenerateDocumentInputDTO } from '../../document/documents-dto/asset-contribution-act-document.dto';
import { ReturnByAssetStatementGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-statement-document.dto';
import { ReturnByAssetDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-decision-document.dto';
import { ReturnByAssetActGenerateDocumentInputDTO } from '../../document/documents-dto/return-by-asset-act-document.dto';
import { AcceptChildOrderInputDTO } from '../dto/accept-child-order-input.dto';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { CancelRequestInputDTO } from '../dto/cancel-request-input.dto';
import { CompleteRequestInputDTO } from '../dto/complete-request-input.dto';
import { ConfirmReceiveOnRequestInputDTO } from '../dto/confirm-receive-on-request.dto';
import { ConfirmSupplyOnRequestInputDTO } from '../dto/confirm-supply-on-request.dto';
import { CreateChildOrderInputDTO } from '../dto/create-child-order-input.dto';
import { CreateParentOfferInputDTO } from '../dto/create-parent-offer-input.dto';
import { DeclineRequestInputDTO } from '../dto/decline-request-input.dto';
import { DeliverOnRequestInputDTO } from '../dto/deliver-on-request-input.dto';
import { DisputeOnRequestInputDTO } from '../dto/dispute-on-request-input.dto';
import { ReceiveOnRequestInputDTO } from '../dto/receive-on-request-input.dto';
import { SupplyOnRequestInputDTO } from '../dto/supply-on-request-input.dto';
import { ReqReturnInputDTO } from '../dto/req-return-input.dto';
import { CoopstockInputDTO } from '../dto/coopstock-input.dto';
import { AcceptStockInputDTO } from '../dto/accept-stock-input.dto';
import { DestroyRequestInputDTO } from '../dto/destroy-request-input.dto';
import { ReofferRequestInputDTO } from '../dto/reoffer-request-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';

@Resolver()
export class CooplaceResolver {
  constructor(private readonly cooplaceService: CooplaceService) {}

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateAssetContributionStatement',
    description: 'Сгенерировать документ заявления о вступлении в кооператив.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateAssetContributionStatement(
    @Args('data', { type: () => AssetContributionStatementGenerateDocumentInputDTO })
    data: AssetContributionStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateAssetContributionStatement(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateAssetContributionDecision',
    description: 'Сгенерировать документ решения о вступлении в кооператив.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateAssetContributionDecision(
    @Args('data', { type: () => AssetContributionDecisionGenerateDocumentInputDTO })
    data: AssetContributionDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateAssetContributionDecision(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateAssetContributionAct',
    description: 'Сгенерировать документ акта приема-передачи.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateAssetContributionAct(
    @Args('data', { type: () => AssetContributionActGenerateDocumentInputDTO })
    data: AssetContributionActGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateAssetContributionAct(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateReturnByAssetStatement',
    description: 'Сгенерировать документ заявления о возврате имущества.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateReturnByAssetStatement(
    @Args('data', { type: () => ReturnByAssetStatementGenerateDocumentInputDTO })
    data: ReturnByAssetStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateReturnByAssetStatement(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateReturnByAssetDecision',
    description: 'Сгенерировать документ решения о возврате имущества.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateReturnByAssetDecision(
    @Args('data', { type: () => ReturnByAssetDecisionGenerateDocumentInputDTO })
    data: ReturnByAssetDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateReturnByAssetDecision(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateReturnByAssetAct',
    description: 'Сгенерировать документ акта возврата имущества.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateReturnByAssetAct(
    @Args('data', { type: () => ReturnByAssetActGenerateDocumentInputDTO })
    data: ReturnByAssetActGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.cooplaceService.generateReturnByAssetAct(data, options);
  }

  @Mutation(() => TransactionDTO, {
    name: 'acceptChildOrder',
    description: 'Подтвердить поставку имущества на заявку',
  })
  async acceptChildOrder(
    @Args('data', { type: () => AcceptChildOrderInputDTO }) data: AcceptChildOrderInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.acceptChildOrder(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'cancelRequest',
    description: 'Отменить заявку',
  })
  async cancelRequest(
    @Args('data', { type: () => CancelRequestInputDTO }) data: CancelRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.cancelRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'completeRequest',
    description: 'Завершить заявку по истечению гарантийного срока',
  })
  async completeRequest(
    @Args('data', { type: () => CompleteRequestInputDTO }) data: CompleteRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.completeRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'confirmReceiveOnRequest',
    description: 'Подтвердить получение имущества Уполномоченным лицом от Заказчика по новации и акту приёмки-передачи',
  })
  async confirmReceiveOnRequest(
    @Args('data', { type: () => ConfirmReceiveOnRequestInputDTO }) data: ConfirmReceiveOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.confirmReceiveOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'confirmSupplyOnRequest',
    description: 'Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи',
  })
  async confirmSupplyOnRequest(
    @Args('data', { type: () => ConfirmSupplyOnRequestInputDTO }) data: ConfirmSupplyOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.confirmSupplyOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'createChildOrder',
    description: 'Создать заявку на поставку имущества по предложению Поставщика',
  })
  async createChildOrder(
    @Args('data', { type: () => CreateChildOrderInputDTO }) data: CreateChildOrderInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.createChildOrder(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'createParentOffer',
    description: 'Создать предложение на поставку имущества',
  })
  async createParentOffer(
    @Args('data', { type: () => CreateParentOfferInputDTO }) data: CreateParentOfferInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.createParentOffer(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'declineRequest',
    description: 'Отклонить заявку',
  })
  async declineRequest(
    @Args('data', { type: () => DeclineRequestInputDTO }) data: DeclineRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.declineRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'deliverOnRequest',
    description: 'Подтвердить доставку имущества Заказчику по заявке',
  })
  async deliverOnRequest(
    @Args('data', { type: () => DeliverOnRequestInputDTO }) data: DeliverOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.deliverOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'disputeOnRequest',
    description: 'Открыть спор по заявке',
  })
  async disputeOnRequest(
    @Args('data', { type: () => DisputeOnRequestInputDTO }) data: DisputeOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.disputeOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'receiveOnRequest',
    description: 'Подтвердить получение имущества Уполномоченным лицом от Заказчика по акту приёмки-передачи',
  })
  async receiveOnRequest(
    @Args('data', { type: () => ReceiveOnRequestInputDTO }) data: ReceiveOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.receiveOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'supplyOnRequest',
    description: 'Подтвердить поставку имущества Поставщиком по заявке Заказчика и акту приёма-передачи',
  })
  async supplyOnRequest(
    @Args('data', { type: () => SupplyOnRequestInputDTO }) data: SupplyOnRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.supplyOnRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'reqReturn',
    description: 'Запросить возврат паевого взноса имуществом (перед получением)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async reqReturn(
    @Args('data', { type: () => ReqReturnInputDTO }) data: ReqReturnInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.reqReturn(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'coopstock',
    description: 'Создать предложение из запасов кооператива',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async coopstock(
    @Args('data', { type: () => CoopstockInputDTO }) data: CoopstockInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.coopstock(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'acceptStock',
    description: 'Принять предложение из запасов кооператива',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async acceptStock(
    @Args('data', { type: () => AcceptStockInputDTO }) data: AcceptStockInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.acceptStock(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'destroyRequest',
    description: 'Уничтожить просроченное имущество',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async destroyRequest(
    @Args('data', { type: () => DestroyRequestInputDTO }) data: DestroyRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.destroyRequest(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'reofferRequest',
    description: 'Перепредложить имущество по новой цене',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async reofferRequest(
    @Args('data', { type: () => ReofferRequestInputDTO }) data: ReofferRequestInputDTO
  ): Promise<TransactionDTO> {
    return this.cooplaceService.reofferRequest(data);
  }
}
