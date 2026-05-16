import { Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCreateShipmentInputDTO,
  MarketplaceCreateShipmentResultDTO,
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
      'Сформировать партии поставки из акцептованной заявки: одна группа на каждый КУ-получатель.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceCreateShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceCreateShipmentInputDTO
  ): Promise<MarketplaceCreateShipmentResultDTO> {
    const result = await this.createService.execute({
      coopname: config.coopname,
      offerer_account: member.username,
      cycle_id: input.cycle_id,
      groups: input.groups.map((g) => ({
        braname: g.braname,
        delivery_variant: g.delivery_variant as unknown as MarketplaceShipmentDeliveryVariant,
        ttn_data: (g.ttn_data ?? null) as MarketplaceShipmentTTNData | null,
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
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceListShipments(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListShipmentsInputDTO
  ): Promise<MarketplaceShipmentDTO[]> {
    const filter: MarketplaceShipmentListFilter = {
      coopname: config.coopname,
      offerer_account: member.username,
      cycle_id: input?.cycle_id,
      braname: input?.braname,
      status: input?.statuses?.length
        ? (input.statuses as MarketplaceShipmentStatus[])
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
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceGetShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('shipment_id') shipment_id: string
  ): Promise<MarketplaceShipmentDTO> {
    const shipment = await this.shipmentRepo.findById(shipment_id);
    if (!shipment || shipment.coopname !== config.coopname) {
      throw new NotFoundException('Партия поставки не найдена.');
    }
    if (shipment.offerer_account !== member.username) {
      throw new NotFoundException('Партия поставки не найдена.');
    }
    return toMarketplaceShipmentDTO(shipment);
  }
}
