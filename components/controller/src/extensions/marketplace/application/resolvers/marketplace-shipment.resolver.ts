import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings, DomainError, RequireRight, SELF } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCreateShipmentInputDTO,
  MarketplaceCreateShipmentResultDTO,
  MarketplaceGetShipmentInputDTO,
  MarketplaceListShipmentsByBranameInputDTO,
  MarketplaceListShipmentsInputDTO,
  MarketplaceShipmentDTO,
  toMarketplaceShipmentDTO,
} from '../dto/marketplace-shipment.dto';
import {
  MARKETPLACE_SHIPMENT_CREATE_SERVICE,
  MarketplaceShipmentCreateService,
} from '../services/marketplace-shipment-create.service';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
  type MarketplaceShipmentListFilter,
} from '../../domain/repositories/marketplace-shipment.repository';
import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from '../../domain/entities/marketplace-shipment.types';

@Resolver()
@Injectable()
export class MarketplaceShipmentResolver {
  constructor(
    @Inject(MARKETPLACE_SHIPMENT_CREATE_SERVICE)
    private readonly createService: MarketplaceShipmentCreateService,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository
  ) {}

  @Mutation(() => MarketplaceCreateShipmentResultDTO, {
    name: 'marketplaceCreateShipment',
    description:
      'Сформировать партии поставки из акцептованной заявки. Каждая группа = одна партия ' +
      '(КУ + вариант доставки + опционально подмножество заказов). Покрытие всех КУ не ' +
      'обязательно — допустима частичная отгрузка и догрузка остатка отдельными партиями.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('Shipment', 'create:own', { of: 'Cycle', id: 'data.cycle_id' })
  async marketplaceCreateShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateShipmentInputDTO
  ): Promise<MarketplaceCreateShipmentResultDTO> {
    const result = await this.createService.execute({
      coopname: platformSettings().coopname,
      offerer_account: member.username,
      cycle_id: data.cycle_id,
      groups: data.groups.map((g) => ({
        braname: g.braname,
        delivery_variant: g.delivery_variant as unknown as MarketplaceShipmentDeliveryVariant,
        ttn_data: (g.ttn_data ?? null) as MarketplaceShipmentTTNData | null,
        order_ids: g.order_ids ?? null,
      })),
    });

    const dto = new MarketplaceCreateShipmentResultDTO();
    dto.shipments = result.shipments.map(toMarketplaceShipmentDTO);
    return dto;
  }

  @Query(() => [MarketplaceShipmentDTO], {
    name: 'marketplaceListShipments',
    description:
      'Список партий поставки текущего поставщика — для стола подготовки поставки и истории.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('Shipment', 'create:own', SELF)
  async marketplaceListShipments(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListShipmentsInputDTO
  ): Promise<MarketplaceShipmentDTO[]> {
    const filter: MarketplaceShipmentListFilter = {
      coopname: platformSettings().coopname,
      offerer_account: member.username,
      cycle_id: data?.cycle_id,
      braname: data?.braname,
      status: data?.statuses?.length
        ? (data.statuses as MarketplaceShipmentStatus[])
        : undefined,
    };
    const list = await this.shipmentRepo.list(filter);
    return list.map(toMarketplaceShipmentDTO);
  }

  @Query(() => [MarketplaceShipmentDTO], {
    name: 'marketplaceListShipmentsByBraname',
    description:
      'Список партий поставки, ожидаемых на кооперативном участке, — для стола приёмки оператора пункта выдачи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('Shipment', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceListShipmentsByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListShipmentsByBranameInputDTO
  ): Promise<MarketplaceShipmentDTO[]> {
    const coopname = platformSettings().coopname;
    const filter: MarketplaceShipmentListFilter = {
      coopname,
      braname: data.braname,
      status: data.statuses?.length
        ? (data.statuses as MarketplaceShipmentStatus[])
        : undefined,
    };
    const list = await this.shipmentRepo.list(filter);
    return list.map(toMarketplaceShipmentDTO);
  }

  @Query(() => MarketplaceShipmentDTO, {
    name: 'marketplaceGetShipment',
    description: 'Получить партию поставки по идентификатору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('Shipment', 'create:own', { of: 'Shipment', id: 'data.shipment_id' })
  async marketplaceGetShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceGetShipmentInputDTO
  ): Promise<MarketplaceShipmentDTO> {
    const shipment = await this.shipmentRepo.findById(data.shipment_id);
    if (!shipment || shipment.coopname !== platformSettings().coopname) {
      throw DomainError.notFound('MARKETPLACE_SHIPMENT_NOT_FOUND');
    }
    return toMarketplaceShipmentDTO(shipment);
  }
}
