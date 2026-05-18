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
    private readonly orderRepo: MarketplaceOrderDomainRepository
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
      actual_quantity: data.actual_quantity,
      delivery_signer: data.delivery_signer,
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
    const doc = await this.service.getOpenIssuanceSignablePayload(
      config.coopname,
      data.order_id,
      member.username
    );
    return toGeneratedDocumentDTO(doc);
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceIssueActOrdererSignablePayload',
    description:
      'Превью акта выдачи имущества для финальной подписи заказчика с указанием фактического количества.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'sign:final')
  async marketplaceIssueActOrdererSignablePayload(
    @Args('data') data: MarketplaceIssueActPayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const doc = await this.service.getFinalizeIssuanceSignablePayload(
      config.coopname,
      data.order_id,
      data.actual_quantity
    );
    return toGeneratedDocumentDTO(doc);
  }

  @Query(() => [MarketplaceOrderDTO], {
    name: 'marketplaceListIssuancesByBraname',
    description:
      'Список заказов на кооперативном участке, ожидающих открытия и финальной подписи выдачи (для оператора кооперативного участка).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Issuance', 'read:own-KU')
  async marketplaceListIssuancesByBraname(
    @Args('data') data: MarketplaceListIssuancesByBranameInputDTO
  ): Promise<MarketplaceOrderDTO[]> {
    const orders = await this.orderRepo.listForIssuanceByBraname(
      config.coopname,
      data.delivery_braname
    );
    return orders.map(toMarketplaceOrderDTO);
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
    return orders.map(toMarketplaceOrderDTO);
  }
}
