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
  MarketplaceAplReceptionByIdInputDTO,
  MarketplaceAplReceptionDTO,
  MarketplaceAplReceptionResultDTO,
  MarketplaceCreateAplReceptionInputDTO,
  MarketplaceCreateExpressReceptionInputDTO,
  MarketplaceCreateExpressReceptionResultDTO,
  MarketplaceExpressPickupCandidateDTO,
  MarketplaceListAplReceptionsByBranameInputDTO,
  MarketplaceListSupplierPickupOrdersInputDTO,
  MarketplaceSignAplReceptionInputDTO,
  toExpressPickupCandidateDTO,
  toMarketplaceAplReceptionDTO,
} from '../dto/marketplace-apl-reception.dto';
import { MarketplaceOrderDTO, toMarketplaceOrderDTO } from '../dto/marketplace-order.dto';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import {
  MARKETPLACE_APL_RECEPTION_SERVICE,
  MarketplaceAplReceptionService,
} from '../services/marketplace-apl-reception.service';
import {
  MARKETPLACE_APL_RECEPTION_REPOSITORY,
  type MarketplaceAplReceptionDomainRepository,
} from '../../domain/repositories/marketplace-apl-reception.repository';
import type { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
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
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly displayService: MarketplaceOrderDisplayService
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

  @Mutation(() => MarketplaceCreateExpressReceptionResultDTO, {
    name: 'marketplaceCreateExpressReception',
    description:
      'Express-приёмка самовывоза по факту присутствия: оператор принимает имущество поставщика без предварительно сформированной партии. Backend синтезирует партию самовывоза из принятых заказов поставщика на этом КУ и открывает приёмку.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceCreateExpressReception(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateExpressReceptionInputDTO
  ): Promise<MarketplaceCreateExpressReceptionResultDTO> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership: оператор может принимать только на своём КУ (как и плановая
    // приёмка) — иначе можно было бы открыть приёмку на чужом участке.
    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        data.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Приёмка доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const result = await this.service.createExpress({
      coopname,
      operator_account: member.username,
      offerer_account: data.offerer_account,
      braname: data.braname,
      fact_quantity_per_order: data.fact_quantity_per_order,
    });
    const dto = new MarketplaceCreateExpressReceptionResultDTO();
    dto.apl_receptions = result.apl_receptions.map((r) => toMarketplaceAplReceptionDTO(r));
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
      'Председатель КУ ставит закрывающую подпись на акте приёмки: имущество переходит на баланс кооператива и одновременно приходуется на склад по указанному месту хранения.',
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
      placements: data.placements,
    });
    const dto = new MarketplaceAplReceptionResultDTO();
    dto.apl_reception = toMarketplaceAplReceptionDTO(result.apl_reception);
    return dto;
  }

  @Mutation(() => MarketplaceAplReceptionResultDTO, {
    name: 'marketplaceCancelAplReception',
    description:
      'Отмена акта приёмки до подписи поставщика — партия возвращается к приёмке для повторного формирования. Доступно оператору КУ и самому поставщику (не согласен с фактом приёмки).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  // Guard: capability проверяем в теле — два легитимных пути (operator:create /
  // offerer:cancel:own), декоратор принимает только один action.
  async marketplaceCancelAplReception(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAplReceptionByIdInputDTO
  ): Promise<MarketplaceAplReceptionResultDTO> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    const reception = await this.receptionRepo.findById(data.apl_reception_id);
    if (!reception || reception.coopname !== coopname) {
      throw new NotFoundException('Акт приёмки не найден.');
    }

    const asOperator = canAccess(roles, 'Receiving', 'create');
    const asSupplier =
      canAccess(roles, 'Receiving', 'cancel:own') &&
      reception.offerer_account === member.username;

    if (!asOperator && !asSupplier) {
      throw new ForbiddenException(
        'Отмена приёмки доступна оператору участка или поставщику этого акта.'
      );
    }

    // Оператор без read:all — только свой КУ (как create/close приёмки).
    if (asOperator && !asSupplier && !canAccess(roles, 'Receiving', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        reception.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Отмена приёмки доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const result = await this.service.cancelReception({
      coopname,
      cancelled_by: member.username,
      apl_reception_id: data.apl_reception_id,
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
      const isMember = await this.kuChairmanService.isMemberOfBranch(
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
      const isMember = await this.kuChairmanService.isMemberOfBranch(
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
    return this.enrichReceptions(list);
  }

  @Query(() => [MarketplaceExpressPickupCandidateDTO], {
    name: 'marketplaceListExpressPickupsByBraname',
    description:
      'Поставщики с принятыми заказами, ожидающими самовывоза на текущем КУ, — лента express-приёмки для operator-стола.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceListExpressPickupsByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListAplReceptionsByBranameInputDTO
  ): Promise<MarketplaceExpressPickupCandidateDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        data.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Лента самовывоза доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const candidates = await this.service.listExpressPickupCandidates(coopname, data.braname);
    return candidates.map(toExpressPickupCandidateDTO);
  }

  @Query(() => [MarketplaceOrderDTO], {
    name: 'marketplaceListSupplierPickupOrders',
    description:
      'Единицы имущества поставщика, ожидающие приёмки на текущем КУ: задекларированные в партии (по ТТН) и добор по акцепту. Базис агрегирующей приёмки для оператора кооперативного участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Receiving', 'create')
  async marketplaceListSupplierPickupOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListSupplierPickupOrdersInputDTO
  ): Promise<MarketplaceOrderDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    if (!canAccess(roles, 'Receiving', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        data.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Лента приёмки доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const orders = await this.service.listSupplierPickupOrders(
      coopname,
      data.braname,
      data.offerer_account
    );
    // Оператору КУ показываем ФИО поставщика/заказчика (экран приёмки «от кого»);
    // резолвер уже ограничен ролью Receiving и членством в КУ.
    const display = await this.displayService.enrich(orders, { withParticipantNames: true });
    return orders.map((order) => toMarketplaceOrderDTO(order, display.get(order.id)));
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
    return this.enrichReceptions(list);
  }

  /**
   * Обогащение списка АПП отображаемыми реквизитами для экранов подписи/сверки:
   * наименование поставщика (ФИО/организация) и наименования товаров по позициям
   * (по order_id из снапшота факта). Оба списочных метода уже авторизованы
   * (оператор/председатель КУ либо сам поставщик), поэтому резолв приватных имён
   * здесь допустим. Best-effort: недостающие имена/товары остаются null.
   */
  private async enrichReceptions(
    list: MarketplaceAplReceptionDomainEntity[]
  ): Promise<MarketplaceAplReceptionDTO[]> {
    if (list.length === 0) return [];
    const offererAccounts = list.map((r) => r.offerer_account);
    const orderIds = list.flatMap((r) => r.fact_quantity_per_order.map((f) => f.order_id));
    const [nameByAccount, displayByOrderId] = await Promise.all([
      this.displayService.resolveAccountNames(offererAccounts),
      // Имена заказчиков нужны для маркировки: этикетка клеится на единицу
      // имущества конкретного заказчика, а не на «десять литров молока».
      this.displayService.enrichByOrderIds(orderIds, { withParticipantNames: true }),
    ]);
    return list.map((r) =>
      toMarketplaceAplReceptionDTO(r, {
        offerer_name: nameByAccount.get(r.offerer_account) ?? null,
        lineByOrderId: new Map(
          r.fact_quantity_per_order.map((f) => [
            f.order_id,
            {
              product_name: displayByOrderId.get(f.order_id)?.product_name ?? null,
              unit_of_measure: displayByOrderId.get(f.order_id)?.unit_of_measure ?? null,
              package_size: displayByOrderId.get(f.order_id)?.package_size ?? null,
              orderer_account: displayByOrderId.get(f.order_id)?.orderer_account ?? null,
              orderer_name: displayByOrderId.get(f.order_id)?.orderer_name ?? null,
            },
          ])
        ),
      })
    );
  }
}
