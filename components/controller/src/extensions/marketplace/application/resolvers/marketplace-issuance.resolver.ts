import { ForbiddenException, Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
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
  MarketplaceAnnounceOrderReadyInputDTO,
  MarketplaceIssueActPayloadInputDTO,
  MarketplaceListIssuancesByBranameInputDTO,
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

  // Единый путь выдачи (см. README расширения): оператор подписывает signiss1 и
  // кладёт его в бандл (marketplaceCreateStockProposal); связка signiss1+signiss2
  // уходит на цепь только при подписи пайщика внутри marketplaceFinalizeStockIssuance.
  // Отдельных он-чейн мутаций открытия/финализации выдачи и member-запросов
  // «готово к получению»/«акт для подписи заказчика» больше нет — сервис-методы
  // openIssuance/finalizeIssuance вызываются ИЗНУТРИ бандла, не из GraphQL.

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

  @Mutation(() => MarketplaceOrderDTO, {
    name: 'marketplaceAnnounceOrderReady',
    description:
      'Объявить заказ готовым к выдаче на пункте (кнопка «Объявить выдачу»). ' +
      'Заказчику уходит уведомление «приходите заберите», в его кабинете заказ ' +
      'помечается «Готово к выдаче». Статус заказа не меняется — сама выдача ' +
      'по-прежнему оформляется при приходе заказчика.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:first')
  async marketplaceAnnounceOrderReady(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAnnounceOrderReadyInputDTO
  ): Promise<MarketplaceOrderDTO> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    const order = await this.orderRepo.findById(data.order_id);
    if (!order || order.coopname !== coopname) {
      throw new NotFoundException('Заказ не найден.');
    }
    // Ownership: оператор только с `read:own-KU` обязан быть членом КУ выдачи
    // заказа, иначе можно объявить готовым чужой заказ по подставленному id.
    if (!canAccess(roles, 'Issuance', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        order.delivery_braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Объявить готовность к выдаче можно только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const updated = await this.service.announceReady({
      coopname,
      order_id: data.order_id,
      operator_account: member.username,
    });
    const display = await this.displayService.enrich([updated], {
      withParticipantNames: true,
      withWarehouseQuantity: true,
    });
    return toMarketplaceOrderDTO(updated, display.get(updated.id));
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
}
