import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  platformSettings,
  GeneratedDocumentDTO,
  DocumentAggregateDTO,
  DomainError,
  GrantedScope,
  RequireRight,
  RightsGuard,
  type IGrantedScope,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import type { InnerGeneratedDocument } from '@coopenomics/innercoop';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceFixIssuanceFactInputDTO,
  MarketplaceIssuanceClosePayloadDTO,
  MarketplaceIssuanceOrderInputDTO,
  MarketplaceIssuanceSagaDTO,
  MarketplaceIssuanceStatementPayloadDTO,
  MarketplaceListIssuanceSagasInputDTO,
  MarketplaceReadyIssueInputDTO,
  MarketplaceSignIssuanceActInputDTO,
  MarketplaceSignIssuanceStatementInputDTO,
  toMarketplaceIssuanceSagaDTO,
} from '../dto/marketplace-issuance-saga.dto';
import { MarketplaceListIssuancesByBranameInputDTO } from '../dto/marketplace-issuance.dto';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import { MARKETPLACE_ISSUANCE_SERVICE, MarketplaceIssuanceService } from '../services/marketplace-issuance.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';

function toGeneratedDocumentDTO(e: InnerGeneratedDocument): GeneratedDocumentDTO {
  const dto = new GeneratedDocumentDTO();
  dto.full_title = e.full_title;
  dto.html = e.html;
  dto.hash = e.hash;
  dto.meta = e.meta;
  dto.binary = e.binary;
  return dto;
}

/**
 * Выдача имущества в паевой модели (компонент 68): оператор фиксирует факт,
 * заказчик одним нажатием подписывает заявление, совет решает, устройство
 * заказчика подписывает акт, устройство оператора закрывает выдачу. Все
 * мутации идемпотентны — повтор после обрыва связи возвращает текущий этап.
 */
@Resolver()
@Injectable()
export class MarketplaceIssuanceResolver {
  constructor(
    @Inject(MARKETPLACE_ISSUANCE_SERVICE)
    private readonly service: MarketplaceIssuanceService,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly displayService: MarketplaceOrderDisplayService
  ) {}

  // ── Стойка оператора ─────────────────────────────────────────────────

  @Query(() => [MarketplaceOrderDTO], {
    name: 'marketplaceListIssuancesByBraname',
    description: 'Лента выдачи участка: заказы от приёма кооперативом до закрытия выдачи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'read:own-KU', { ku: 'data.delivery_braname' })
  async marketplaceListIssuancesByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListIssuancesByBranameInputDTO
  ): Promise<MarketplaceOrderDTO[]> {
    const coopname = platformSettings().coopname;
    const orders = await this.orderRepo.listForIssuanceByBraname(coopname, data.delivery_braname);
    // withWarehouseQuantity: оператор обязан видеть, сколько по заказу реально
    // принято на склад — выдача ограничена этим количеством, не заказанным.
    const display = await this.displayService.enrich(orders, {
      withParticipantNames: true,
      withWarehouseQuantity: true,
      withOrdererVerification: true,
    });
    return orders.map((order) => toMarketplaceOrderDTO(order, display.get(order.id)));
  }

  @Mutation(() => MarketplaceOrderDTO, {
    name: 'marketplaceReadyIssue',
    description: 'Оператор участка выдачи отмечает поступление имущества по заказу: заказчику уходит уведомление «приходите заберите». Без подписи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'create', { of: 'Order', id: 'data.order_id' })
  async marketplaceReadyIssue(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceReadyIssueInputDTO
  ): Promise<MarketplaceOrderDTO> {
    const coopname = platformSettings().coopname;
    const order = await this.service.readyIssue({ coopname, order_id: data.order_id, operator_account: member.username });
    const display = await this.displayService.enrich([order], {
      withParticipantNames: true,
      withWarehouseQuantity: true,
      withOrdererVerification: true,
    });
    return toMarketplaceOrderDTO(order, display.get(order.id));
  }

  @Mutation(() => MarketplaceIssuanceStatementPayloadDTO, {
    name: 'marketplaceFixIssuanceFact',
    description: 'Оператор у стойки сверил состав и отправляет факт на подпись заказчику: рождается ход выдачи и заявление о возврате паевого взноса имуществом. Подписи оператора нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'create', { of: 'Order', id: 'data.order_id' })
  async marketplaceFixIssuanceFact(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceFixIssuanceFactInputDTO
  ): Promise<MarketplaceIssuanceStatementPayloadDTO> {
    const coopname = platformSettings().coopname;
    const { saga, statement } = await this.service.fixFact({
      coopname,
      operator_account: member.username,
      order_id: data.order_id,
      proposal_id: data.proposal_id ?? null,
      actual_quantity: data.actual_quantity,
      actual_unit_price: data.actual_unit_price,
    });
    return { saga: toMarketplaceIssuanceSagaDTO(saga), statement: toGeneratedDocumentDTO(statement) };
  }

  @Query(() => MarketplaceIssuanceClosePayloadDTO, {
    name: 'marketplaceIssuanceClosePayload',
    description: 'Акт с подписью заказчика для закрывающей подписи оператора участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'close', { of: 'Order', id: 'data.order_id' })
  async marketplaceIssuanceClosePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<MarketplaceIssuanceClosePayloadDTO> {
    const coopname = platformSettings().coopname;
    const saga = await this.service.getSagaByOrder(coopname, data.order_id);
    if (!saga) throw DomainError.forbidden('MARKETPLACE_ISSUANCE_NOT_STARTED');
    const aggregate = await this.service.getCloseSignablePayload(coopname, data.order_id);
    return { saga: toMarketplaceIssuanceSagaDTO(saga), act_aggregate: new DocumentAggregateDTO(aggregate) };
  }

  @Mutation(() => MarketplaceIssuanceSagaDTO, {
    name: 'marketplaceCloseIssuance',
    description: 'Закрывающая подпись акта председателем, доверенным или оператором участка выдачи: паевой взнос возвращён имуществом, заказ получен. Имущество передаётся после этого ответа.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'close', { of: 'Order', id: 'data.order_id' })
  async marketplaceCloseIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignIssuanceActInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO> {
    const coopname = platformSettings().coopname;
    const saga = await this.service.closeIssuance({ coopname, operator_account: member.username, order_id: data.order_id, signed_act: data.signed_act });
    return toMarketplaceIssuanceSagaDTO(saga);
  }

  @Mutation(() => MarketplaceIssuanceSagaDTO, {
    name: 'marketplaceCancelIssuance',
    description: 'Оператор отменяет начатую выдачу (заказчик не подписал акт или ушёл): заказ снова готов к выдаче, средства не двигались.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'cancel', { of: 'Order', id: 'data.order_id' })
  async marketplaceCancelIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO> {
    const coopname = platformSettings().coopname;
    const saga = await this.service.cancelIssuance({ coopname, operator_account: member.username, order_id: data.order_id });
    return toMarketplaceIssuanceSagaDTO(saga);
  }

  // ── Заказчик ─────────────────────────────────────────────────────────

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceIssuanceStatementPayload',
    description: 'Заявление о возврате паевого взноса имуществом к подписи заказчиком по начатой выдаче.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'sign:statement', { of: 'Order', id: 'data.order_id' })
  async marketplaceIssuanceStatementPayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.service.getStatementSignablePayload(platformSettings().coopname, data.order_id, member.username);
    return toGeneratedDocumentDTO(doc);
  }

  @Query(() => GeneratedDocumentDTO, {
    nullable: true,
    name: 'marketplaceIssuanceConvertPayload',
    description:
      'Заявление 1110 на доплату по факту (разница тела и довзнос участка) — к подписи заказчиком вместе ' +
      'с заявлением о выдаче, только если факт больше заказа и членского кошелька «Стола заказов» не хватает на довзнос; иначе null.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'sign:statement', { of: 'Order', id: 'data.order_id' })
  async marketplaceIssuanceConvertPayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<GeneratedDocumentDTO | null> {
    const doc = await this.service.getConvertSignablePayload(platformSettings().coopname, data.order_id, member.username);
    return doc ? toGeneratedDocumentDTO(doc) : null;
  }

  @Mutation(() => MarketplaceIssuanceSagaDTO, {
    name: 'marketplaceSignIssuanceStatement',
    description: 'Заказчик подписал заявление: оно уходит совету. Если робот решений совета ответил сразу, в ответе уже есть протокол и акт к подписи; иначе выдача ждёт решение — придёт уведомление.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'sign:statement', { of: 'Order', id: 'data.order_id' })
  async marketplaceSignIssuanceStatement(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignIssuanceStatementInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO> {
    const saga = await this.service.submitStatement({ coopname: platformSettings().coopname, member_account: member.username, order_id: data.order_id, signed_statement: data.signed_statement, signed_convert: data.signed_convert ?? null });
    return toMarketplaceIssuanceSagaDTO(saga);
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceIssuanceActPayload',
    description: 'Акт приёма-передачи к первой подписи заказчиком после решения совета.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'sign:act', { of: 'Order', id: 'data.order_id' })
  async marketplaceIssuanceActPayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.service.getActSignablePayload(platformSettings().coopname, data.order_id, member.username);
    return toGeneratedDocumentDTO(doc);
  }

  @Mutation(() => MarketplaceIssuanceSagaDTO, {
    name: 'marketplaceSignIssuanceAct',
    description: 'Первая подпись акта заказчиком: дальше оператор закрывает выдачу.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', 'sign:act', { of: 'Order', id: 'data.order_id' })
  async marketplaceSignIssuanceAct(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSignIssuanceActInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO> {
    const saga = await this.service.signAct1({ coopname: platformSettings().coopname, member_account: member.username, order_id: data.order_id, signed_act: data.signed_act });
    return toMarketplaceIssuanceSagaDTO(saga);
  }

  // ── Чтение хода выдачи ───────────────────────────────────────────────

  @Query(() => MarketplaceIssuanceSagaDTO, {
    name: 'marketplaceIssuanceSaga',
    nullable: true,
    description: 'Ход выдачи по заказу: заказчик видит свой, персонал участка — по своему участку.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', ['read:own', 'read:own-KU'], { of: 'IssuanceSaga', id: 'data.order_id' })
  async marketplaceIssuanceSaga(
    @Args('data') data: MarketplaceIssuanceOrderInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO | null> {
    const saga = await this.service.getSagaByOrder(platformSettings().coopname, data.order_id);
    return saga ? toMarketplaceIssuanceSagaDTO(saga) : null;
  }

  @Query(() => [MarketplaceIssuanceSagaDTO], {
    name: 'marketplaceListIssuanceSagas',
    description: 'Незавершённые выдачи: свои у заказчика, по участку у стойки оператора.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Issuance', ['read:own', 'read:own-KU'], { list: 'data.braname' })
  async marketplaceListIssuanceSagas(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @GrantedScope() scope: IGrantedScope,
    @Args('data', { nullable: true }) data?: MarketplaceListIssuanceSagasInputDTO
  ): Promise<MarketplaceIssuanceSagaDTO[]> {
    const coopname = platformSettings().coopname;
    const active_only = data?.active_only ?? true;
    // Участок в запросе — стойка оператора: гард сверил, что участок его.
    // Без участка, как и у заказчика без роли оператора, — свои выдачи.
    if (data?.braname && scope.kus) {
      const list = await this.service.listSagas({ coopname, braname: data.braname, proposal_id: data.proposal_id, active_only });
      return list.map(toMarketplaceIssuanceSagaDTO);
    }
    const list = await this.service.listSagas({ coopname, member_account: member.username, proposal_id: data?.proposal_id, active_only });
    return list.map(toMarketplaceIssuanceSagaDTO);
  }
}
