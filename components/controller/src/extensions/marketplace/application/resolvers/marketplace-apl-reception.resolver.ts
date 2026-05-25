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
  MARKETPLACE_KU_CHAIRMEN_SERVICE,
  type MarketplaceKuChairmenService,
} from '../services/marketplace-ku-chairmen.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAplReceptionByIdInputDTO,
  MarketplaceAplReceptionDTO,
  MarketplaceAplReceptionResultDTO,
  MarketplaceCreateAplReceptionInputDTO,
  MarketplaceListAplReceptionsByBranameInputDTO,
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
export class MarketplaceAplReceptionResolver {
  constructor(
    @Inject(MARKETPLACE_APL_RECEPTION_SERVICE)
    private readonly service: MarketplaceAplReceptionService,
    @Inject(MARKETPLACE_APL_RECEPTION_REPOSITORY)
    private readonly receptionRepo: MarketplaceAplReceptionDomainRepository,
    @Inject(MARKETPLACE_KU_CHAIRMEN_SERVICE)
    private readonly kuChairmenService: MarketplaceKuChairmenService
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
    @Args('data') data: MarketplaceCreateAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.create({
      coopname: config.coopname,
      operator_account: member.username,
      shipment_id: data.shipment_id,
      fact_quantity_per_order: data.fact_quantity_per_order,
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
    @Args('data') data: MarketplaceSignAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.signAsSupplier({
      coopname: config.coopname,
      supplier_account: member.username,
      apl_reception_id: data.apl_reception_id,
      signed_documents: data.signed_documents,
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
    @Args('data') data: MarketplaceSignAplReceptionInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const result = await this.service.signAsChairman({
      coopname: config.coopname,
      chairman_account: member.username,
      apl_reception_id: data.apl_reception_id,
      signed_documents: data.signed_documents,
    });
    const dto = new MarketplaceAplReceptionResultDTO();
    dto.apl_reception = toMarketplaceAplReceptionDTO(result.apl_reception);
    return dto;
  }

  @Query(() => [GeneratedDocumentDTO], {
    name: 'marketplaceAplReceptionSupplierSignablePayloads',
    description:
      'Preview-документы акта приёмки для подписи поставщиком — один документ на каждый Order группы. Клиент подписывает hash приватным ключом и возвращает результат в mutation marketplaceSignAplReceptionAsSupplier.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:first')
  async marketplaceAplReceptionSupplierSignablePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAplReceptionByIdInputDTO
  ): Promise<GeneratedDocumentDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера. `sign:first` есть у
    // роли offerer (поставщика), поэтому без проверки владельца любой поставщик
    // прочитал бы акт приёмки чужой партии по подставленному apl_reception_id.
    // Превью подписи поставщика доступно только поставщику этой приёмки.
    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const reception = await this.receptionRepo.findById(data.apl_reception_id);
      if (!reception || reception.coopname !== coopname) {
        throw new NotFoundException('Акт приёмки не найден.');
      }
      if (reception.offerer_account !== member.username) {
        throw new ForbiddenException(
          'Превью акта приёмки доступно только поставщику этой партии.'
        );
      }
    }

    const docs = await this.service.getSupplierSignablePayloads(
      coopname,
      data.apl_reception_id
    );
    return docs.map(toGeneratedDocumentDTO);
  }

  @Query(() => [DocumentAggregateDTO], {
    name: 'marketplaceAplReceptionChairmanSignablePayloads',
    description:
      'Акты приёмки, уже подписанные поставщиком, для закрывающей подписи председателя КУ. Каждый элемент содержит исходный документ для ознакомления и подпись поставщика; председатель накладывает свою подпись поверх.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'sign:closing')
  async marketplaceAplReceptionChairmanSignablePayloads(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAplReceptionByIdInputDTO
  ): Promise<DocumentAggregateDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера (сервис игнорирует
    // chairman_account). `sign:closing` есть у роли operator, поэтому оператор
    // только с правами своего КУ обязан быть членом КУ приёмки, иначе утечёт
    // акт чужого участка по подставленному apl_reception_id.
    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const reception = await this.receptionRepo.findById(data.apl_reception_id);
      if (!reception || reception.coopname !== coopname) {
        throw new NotFoundException('Акт приёмки не найден.');
      }
      const isMember = await this.kuChairmenService.isMemberOfBranch(
        coopname,
        reception.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Превью акта приёмки доступно только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const aggregates = await this.service.getChairmanSignablePayloads(
      coopname,
      data.apl_reception_id,
      member.username
    );
    return aggregates.map((a) => new DocumentAggregateDTO(a));
  }

  @Query(() => [MarketplaceAplReceptionDTO], {
    name: 'marketplaceListAplReceptionsByBraname',
    description: 'Список акций приёмки текущего КУ для operator-стола.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceListAplReceptionsByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListAplReceptionsByBranameInputDTO
  ): Promise<MarketplaceAplReceptionDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера (matrix даёт только
    // capability `Receiving:create`). Оператор только с правами своего КУ обязан
    // быть членом запрашиваемого участка, иначе утечёт лента приёмок чужого КУ.
    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const isMember = await this.kuChairmenService.isMemberOfBranch(
        coopname,
        data.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Лента приёмок доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const list = await this.receptionRepo.listByBraname(coopname, data.braname);
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
