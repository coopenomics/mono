import { ForbiddenException, Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceFinalizeIssuanceInputDTO,
  MarketplaceIssuanceResultDTO,
  MarketplaceIssueActPayloadInputDTO,
  MarketplaceListIssuancesByBranameInputDTO,
  MarketplaceOpenIssuanceInputDTO,
} from '../dto/marketplace-issuance.dto';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import {
  MARKETPLACE_ISSUANCE_SERVICE,
  MarketplaceIssuanceService,
} from '../services/marketplace-issuance.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';

function toGeneratedDocumentDTO(e: DocumentDomainEntity): GeneratedDocumentDTO {
  const dto = new GeneratedDocumentDTO();
  dto.full_title = e.full_title;
  dto.html = e.html;
  dto.hash = e.hash;
  dto.meta = e.meta;
  dto.binary = e.binary;
  return dto;
}

@Resolver()
@Injectable()
export class MarketplaceIssuanceResolver {
  constructor(
    @Inject(MARKETPLACE_ISSUANCE_SERVICE)
    private readonly service: MarketplaceIssuanceService,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly displayService: MarketplaceOrderDisplayService
  ) {}

  @Mutation(() => MarketplaceIssuanceResultDTO, {
    name: 'marketplaceOpenIssuance',
    description:
      'Председатель кооперативного участка открывает выдачу первой подписью акта — заказ готов к получению пайщиком.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:first')
  async marketplaceOpenIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceOpenIssuanceInputDTO
  ): Promise<MarketplaceIssuanceResultDTO> {
    const result = await this.service.openIssuance({
      coopname: config.coopname,
      chairman_account: member.username,
      order_id: data.order_id,
      actual_quantity: data.actual_quantity,
      actual_unit_price: data.actual_unit_price,
      signed_document: data.signed_document,
    });
    return new MarketplaceIssuanceResultDTO({
      order: toMarketplaceOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Mutation(() => MarketplaceIssuanceResultDTO, {
    name: 'marketplaceFinalizeIssuance',
    description:
      'Заказчик ставит финальную подпись акта выдачи — имущество переходит к нему, в зависимости от сверки факта применяются корректирующие операции.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:final')
  async marketplaceFinalizeIssuance(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceFinalizeIssuanceInputDTO
  ): Promise<MarketplaceIssuanceResultDTO> {
    const result = await this.service.finalizeIssuance({
      coopname: config.coopname,
      orderer_account: member.username,
      order_id: data.order_id,
      signed_document: data.signed_document,
    });
    return new MarketplaceIssuanceResultDTO({
      order: toMarketplaceOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceIssueActChairmanSignablePayload',
    description:
      'Превью акта выдачи имущества для подписания председателем кооперативного участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:first')
  async marketplaceIssueActChairmanSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssueActPayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера (matrix даёт только
    // capability). Превью акта раскрывает ФИО/состав заказа, поэтому оператор
    // только с `read:own-KU` обязан быть членом КУ выдачи запрашиваемого заказа,
    // иначе утечёт акт чужого участка по подставленному order_id.
    if (!canAccess(roles, 'Issuance', 'read:all')) {
      const order = await this.orderRepo.findById(data.order_id);
      if (!order || order.coopname !== coopname) {
        throw new NotFoundException('Заказ не найден.');
      }
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        order.delivery_braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Превью акта выдачи доступно только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const doc = await this.service.getOpenIssuanceSignablePayload(
      coopname,
      data.order_id,
      member.username,
      data.actual_quantity,
      data.actual_unit_price
    );
    return toGeneratedDocumentDTO(doc);
  }

  @Query(() => DocumentAggregateDTO, {
    name: 'marketplaceIssueActOrdererSignablePayload',
    description:
      'Акт выдачи, уже подписанный председателем, для финальной подписи заказчика. Содержит исходный документ для ознакомления и подпись председателя; заказчик накладывает свою подпись поверх.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:final')
  async marketplaceIssueActOrdererSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceIssueActPayloadInputDTO
  ): Promise<DocumentAggregateDTO> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера. `sign:final` есть у
    // каждого пайщика (роль orderer), поэтому без проверки владельца любой
    // пайщик прочитал бы акт чужого заказа по подставленному order_id.
    //
    // Канон выдачи (UX-DR4, см. finalizeIssuance): заказчик ставит финальную
    // подпись на устройстве оператора КУ (operator-assisted POS) — сессия при
    // этом оператора, а не заказчика. Поэтому превью доступно либо самому
    // заказчику, либо члену КУ выдачи (председатель/доверенное лицо/оператор),
    // который проводит выдачу — иначе превью утечёт по подставленному order_id.
    // Сама финальная подпись всё равно обязана нести ключ заказчика-владельца —
    // это отдельно проверяет finalizeIssuance по signer'у подписи.
    if (!canAccess(roles, 'Issuance', 'read:all')) {
      const order = await this.orderRepo.findById(data.order_id);
      if (!order || order.coopname !== coopname) {
        throw new NotFoundException('Заказ не найден.');
      }
      const isOrderer = order.orderer_account === member.username;
      const isKuMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        order.delivery_braname,
        member.username
      );
      if (!isOrderer && !isKuMember) {
        throw new ForbiddenException(
          'Превью акта выдачи доступно заказчику или члену кооперативного участка выдачи.'
        );
      }
    }

    const aggregate = await this.service.getFinalizeIssuanceSignablePayload(
      coopname,
      data.order_id
    );
    return new DocumentAggregateDTO(aggregate);
  }

  @Query(() => [MarketplaceOrderDTO], {
    name: 'marketplaceListIssuancesByBraname',
    description:
      'Список заказов на кооперативном участке, ожидающих открытия и финальной подписи выдачи (для оператора кооперативного участка).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'read:own-KU')
  async marketplaceListIssuancesByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListIssuancesByBranameInputDTO
  ): Promise<MarketplaceOrderDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера (matrix даёт только
    // capability). Роль с `Issuance:read:all` видит ленту любого КУ; роль
    // только с `read:own-KU` (оператор/председатель КУ) обязана быть членом
    // запрашиваемого участка, иначе утечёт лента выдач чужого КУ.
    if (!canAccess(roles, 'Issuance', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        data.delivery_braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Лента выдач доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const orders = await this.orderRepo.listForIssuanceByBraname(
      coopname,
      data.delivery_braname
    );
    // withWarehouseQuantity: оператор обязан видеть, сколько по заказу реально
    // принято на склад — выдача ограничена этим количеством, не заказанным.
    const display = await this.displayService.enrich(orders, {
      withParticipantNames: true,
      withWarehouseQuantity: true,
    });
    return orders.map((order) => toMarketplaceOrderDTO(order, display.get(order.id)));
  }

  @Query(() => [MarketplaceOrderDTO], {
    name: 'marketplaceListMyReadyToReceive',
    description:
      'Список заказов текущего пайщика, готовых к получению на пункте выдачи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'read:own')
  async marketplaceListMyReadyToReceive(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceOrderDTO[]> {
    const orders = await this.orderRepo.listReadyToReceiveByOrderer(
      config.coopname,
      member.username
    );
    const display = await this.displayService.enrich(orders, {
      withParticipantNames: true,
      withWarehouseQuantity: true,
    });
    return orders.map((order) => toMarketplaceOrderDTO(order, display.get(order.id)));
  }
}
