import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAplReceptionDTO,
  MarketplaceAplReceptionResultDTO,
  MarketplaceAplReceptionSignablePayloadDTO,
  MarketplaceCreateAplReceptionInputDTO,
  MarketplaceSignAplReceptionInputDTO,
  toMarketplaceAplReceptionDTO,
} from '../dto/marketplace-apl-reception.dto';
import {
  MARKETPLACE_APL_RECEPTION_SERVICE,
  MarketplaceAplReceptionService,
} from '../services/marketplace-apl-reception.service';
import {
  MARKETPLACE_APL_RECEPTION_REPOSITORY,
  type MarketplaceAplReceptionDomainRepository,
} from '../../domain/repositories/marketplace-apl-reception.repository';

import type { AplReceptionSignablePayload } from '../../domain/services/marketplace-apl-reception-document-factory';

function toSignablePayloadDTO(p: AplReceptionSignablePayload): MarketplaceAplReceptionSignablePayloadDTO {
  const dto = new MarketplaceAplReceptionSignablePayloadDTO();
  dto.order_id = p.order_id;
  dto.order_hash = p.order_hash;
  dto.version = p.version;
  dto.meta = p.meta;
  dto.meta_hash = p.meta_hash;
  dto.doc_hash = p.doc_hash;
  dto.hash = p.hash;
  return dto;
}

@Resolver()
@Injectable()
export class MarketplaceAplReceptionResolver {
  constructor(
    @Inject(MARKETPLACE_APL_RECEPTION_SERVICE)
    private readonly service: MarketplaceAplReceptionService,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    private readonly receptionRepo: MarketplaceAplReceptionDomainRepository
  ) {}

  @Mutation(() => MarketplaceAplReceptionResultDTO, {
    name: 'marketplaceCreateAplReception',
    description:
      'Оператор КУ формирует акт приёмки партии: для Варианта Б с возможной корректировкой фактического количества.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceCreateAplReception(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceCreateAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.create({
      coopname: config.coopname,
      operator_account: member.username,
      shipment_id: input.shipment_id,
      fact_quantity_per_order: input.fact_quantity_per_order,
    });
    const dto = new MarketplaceAplReceptionResultDTO();
    dto.apl_reception = toMarketplaceAplReceptionDTO(result.apl_reception);
    return dto;
  }

  @Mutation(() => MarketplaceAplReceptionResultDTO, {
    name: 'marketplaceSignAplReceptionAsSupplier',
    description:
      'Поставщик ставит первую подпись на акте приёмки (лично — Вариант А; асинхронно через push — Вариант Б).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:first')
  async marketplaceSignAplReceptionAsSupplier(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSignAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.signAsSupplier({
      coopname: config.coopname,
      supplier_account: member.username,
      apl_reception_id: input.apl_reception_id,
      signed_documents: input.signed_documents?.map((sd) => ({
        order_id: sd.order_id,
        signed_document: sd.signed_document,
      })),
    });
    const dto = new MarketplaceAplReceptionResultDTO();
    dto.apl_reception = toMarketplaceAplReceptionDTO(result.apl_reception);
    return dto;
  }

  @Mutation(() => MarketplaceAplReceptionResultDTO, {
    name: 'marketplaceSignAplReceptionAsChairman',
    description:
      'Председатель КУ ставит закрывающую подпись на акте приёмки — имущество переходит на баланс кооператива.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:closing')
  async marketplaceSignAplReceptionAsChairman(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSignAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.signAsChairman({
      coopname: config.coopname,
      chairman_account: member.username,
      apl_reception_id: input.apl_reception_id,
      signed_documents: input.signed_documents?.map((sd) => ({
        order_id: sd.order_id,
        signed_document: sd.signed_document,
      })),
    });
    const dto = new MarketplaceAplReceptionResultDTO();
    dto.apl_reception = toMarketplaceAplReceptionDTO(result.apl_reception);
    return dto;
  }

  @Query(() => [MarketplaceAplReceptionSignablePayloadDTO], {
    name: 'marketplaceAplReceptionSupplierSignablePayloads',
    description:
      'Подписные документы Document2 per-Order для подписи поставщиком на клиенте. ' +
      'Клиент берёт hash каждого payload, подписывает приватным ключом, шлёт ' +
      'обратно в mutation marketplaceSignAplReceptionAsSupplier.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:first')
  async marketplaceAplReceptionSupplierSignablePayloads(
    @Args('apl_reception_id') apl_reception_id: string
  ): Promise<MarketplaceAplReceptionSignablePayloadDTO[]> {
    const payloads = await this.service.getSupplierSignablePayloads(
      config.coopname,
      apl_reception_id
    );
    return payloads.map(toSignablePayloadDTO);
  }

  @Query(() => [MarketplaceAplReceptionSignablePayloadDTO], {
    name: 'marketplaceAplReceptionChairmanSignablePayloads',
    description:
      'Подписные документы Document2 per-Order для закрывающей подписи председателя КУ.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:closing')
  async marketplaceAplReceptionChairmanSignablePayloads(
    @Args('apl_reception_id') apl_reception_id: string
  ): Promise<MarketplaceAplReceptionSignablePayloadDTO[]> {
    const payloads = await this.service.getChairmanSignablePayloads(
      config.coopname,
      apl_reception_id
    );
    return payloads.map(toSignablePayloadDTO);
  }

  @Query(() => [MarketplaceAplReceptionDTO], {
    name: 'marketplaceListAplReceptionsByKu',
    description: 'Список акций приёмки текущего КУ для operator-стола.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceListAplReceptionsByKu(
    @CurrentMarketplaceMember() _member: IMarketplaceCurrentMember,
    @Args('ku_id') ku_id: string
  ): Promise<MarketplaceAplReceptionDTO[]> {
    const list = await this.receptionRepo.listByKu(config.coopname, ku_id);
    return list.map(toMarketplaceAplReceptionDTO);
  }

  @Query(() => [MarketplaceAplReceptionDTO], {
    name: 'marketplaceListAplReceptionsAsSupplier',
    description: 'Список актов приёмки, ожидающих подписи текущего поставщика.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceListAplReceptionsAsSupplier(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceAplReceptionDTO[]> {
    const list = await this.receptionRepo.listByOfferer(config.coopname, member.username);
    return list.map(toMarketplaceAplReceptionDTO);
  }
}
