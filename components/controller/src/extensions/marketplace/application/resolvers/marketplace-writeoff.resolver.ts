import { BadRequestException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
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
  MarketplaceConfirmWriteoffInputDTO,
  MarketplaceCreateWriteoffDraftInputDTO,
  MarketplaceListWriteoffProposalsInputDTO,
  MarketplaceSubmitWriteoffDraftInputDTO,
  MarketplaceUpdateWriteoffDraftInputDTO,
  MarketplaceWriteoffCandidateDTO,
  MarketplaceWriteoffConfirmationGroupDTO,
  MarketplaceWriteoffProposalDTO,
  MarketplaceWriteoffProposalStatusEnum,
  MarketplaceWriteoffServiceMemoSignablePayloadInputDTO,
  MarketplaceWriteoffStatementSignablePayloadInputDTO,
  PaginatedMarketplaceWriteoffProposalsDTO,
} from '../dto/marketplace-writeoff.dto';
import { MarketplaceWriteoffService } from '../services/marketplace-writeoff.service';
import { toMarketplaceWriteoffProposalDTO } from './marketplace-writeoff.mapper';

function toGeneratedDocumentDTO(e: DocumentDomainEntity): GeneratedDocumentDTO {
  const dto = new GeneratedDocumentDTO();
  dto.full_title = e.full_title;
  dto.html = e.html;
  dto.hash = e.hash;
  dto.meta = e.meta;
  dto.binary = e.binary;
  return dto;
}

/**
 * Эпик 8: GraphQL-фасад для процесса списания скоропорта через решение
 * совета.
 *
 * Пайплайн пользователя (общий администратор / председатель):
 *  1. `marketplaceCreateWriteoffDraft` — собрать корзину (или подобрать
 *     автоматически выставленную крон-сервисом).
 *  2. `marketplaceUpdateWriteoffDraft` — поправить состав.
 *  3. `marketplaceWriteoffStatementSignablePayload` — получить Заявление
 *     1106 для подписания председателем.
 *  4. `marketplaceSubmitWriteoffDraft` — отправить подписанное Заявление,
 *     запускается `propwroff` + `soviet::createagenda(mktwroff)`.
 *
 * Дальше пайплайн ведёт стандартный sov.decision-flow: совет голосует и
 * подписывает Протокол 1105 — callback `marketplace::onmktwoauth` через
 * листенер дельты ставит проект в AUTHORIZED, и backend сам циклом
 * проводит per-item списания. UI здесь только наблюдает.
 */
@Resolver()
@Injectable()
export class MarketplaceWriteoffResolver {
  constructor(
    private readonly service: MarketplaceWriteoffService,
    private readonly documentDomainService: DocumentDomainService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Query(() => MarketplaceWriteoffProposalDTO, {
    nullable: true,
    name: 'marketplaceOpenWriteoffDraft',
    description: 'Открытый черновик проекта списания (если есть). Один на кооператив.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'read:all')
  async marketplaceOpenWriteoffDraft(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceWriteoffProposalDTO | null> {
    const draft = await this.service.getOpenDraft(config.coopname);
    if (!draft) return null;
    const dto = toMarketplaceWriteoffProposalDTO(draft);
    await this.enrichItemBranchNames([dto]);
    return dto;
  }

  @Query(() => PaginatedMarketplaceWriteoffProposalsDTO, {
    name: 'marketplaceListWriteoffProposals',
    description: 'Лента всех проектов списания кооператива с фильтром по статусу.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'read:all')
  async marketplaceListWriteoffProposals(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListWriteoffProposalsInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginatedMarketplaceWriteoffProposalsDTO> {
    const result = await this.service.listProposals({
      coopname: config.coopname,
      statuses: data.statuses as unknown as MarketplaceWriteoffProposalStatusEnum[] | undefined,
      pagination: options,
    });
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const items = result.items.map(toMarketplaceWriteoffProposalDTO);
    await this.enrichItemBranchNames(items);
    return {
      items,
      totalCount: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
      currentPage: page,
    } as PaginatedMarketplaceWriteoffProposalsDTO;
  }

  @Query(() => MarketplaceWriteoffProposalDTO, {
    name: 'marketplaceWriteoffProposal',
    description: 'Детали одного проекта списания: items, decision_log, протокол.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'read:all')
  async marketplaceWriteoffProposal(
    @Args('id') id: string
  ): Promise<MarketplaceWriteoffProposalDTO> {
    const dto = toMarketplaceWriteoffProposalDTO(await this.service.getProposal(id));
    await this.enrichItemBranchNames([dto]);
    return dto;
  }

  @Mutation(() => MarketplaceWriteoffProposalDTO, {
    name: 'marketplaceCreateWriteoffDraft',
    description:
      'Создаёт ручной черновик проекта списания. На кооператив может быть только один открытый черновик и один проект, отправленный в совет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'manage_draft')
  async marketplaceCreateWriteoffDraft(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateWriteoffDraftInputDTO
  ): Promise<MarketplaceWriteoffProposalDTO> {
    const draft = await this.service.createDraft({
      coopname: config.coopname,
      trigger: 'manual',
      proposed_by_account: member.username,
      cycle_started_at: data.cycle_started_at ? new Date(data.cycle_started_at) : undefined,
      items: data.items,
    });
    return toMarketplaceWriteoffProposalDTO(draft);
  }

  @Mutation(() => MarketplaceWriteoffProposalDTO, {
    name: 'marketplaceUpdateWriteoffDraft',
    description: 'Изменить состав черновика — добавить, удалить или поправить позиции.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'manage_draft')
  async marketplaceUpdateWriteoffDraft(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUpdateWriteoffDraftInputDTO
  ): Promise<MarketplaceWriteoffProposalDTO> {
    const updated = await this.service.updateDraft({
      id: data.id,
      actor: member.username,
      items: data.items,
    });
    return toMarketplaceWriteoffProposalDTO(updated);
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceCancelWriteoffDraft',
    description: 'Удалить черновик. Доступно только пока проект в статусе DRAFT.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'manage_draft')
  async marketplaceCancelWriteoffDraft(
    @Args('id') id: string
  ): Promise<boolean> {
    await this.service.cancelDraft(id);
    return true;
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceWriteoffStatementSignablePayload',
    description:
      'Превью Заявления о списании скоропорта (registry 1106) для подписания председателем.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'propose')
  async marketplaceWriteoffStatementSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceWriteoffStatementSignablePayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const draft = await this.service.getProposal(data.draft_id);
    if (!draft.is_draft) {
      throw new BadRequestException('Подписать Заявление можно только для черновика (DRAFT)');
    }
    const proposalHash = this.service.computeProposalHash({
      coopname: draft.coopname,
      cycle_started_at: draft.cycle_started_at.toISOString(),
      draft_id: draft.id,
      items: draft.items,
    });
    const action: Cooperative.Registry.MarketplaceWriteoffStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceWriteoffStatement.registry_id,
      coopname: draft.coopname,
      username: member.username,
      lang: 'ru',
      proposal_hash: proposalHash,
      cycle_started_at: draft.cycle_started_at.toISOString(),
      items: draft.items.map((it) => ({
        braname: it.braname,
        asset_title: it.asset_title,
        quantity: it.quantity,
        amount: it.amount,
        reason: it.reason,
      })),
      total_amount: draft.total_amount,
    };
    const document = await this.documentDomainService.generateDocument({
      data: action,
    });
    return toGeneratedDocumentDTO(document);
  }

  @Mutation(() => MarketplaceWriteoffProposalDTO, {
    name: 'marketplaceSubmitWriteoffDraft',
    description:
      'Отправить черновик в совет. Принимает подписанное председателем Заявление 1106. После успешного приёма выполняются propwroff и soviet::createagenda(mktwroff).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'propose')
  async marketplaceSubmitWriteoffDraft(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSubmitWriteoffDraftInputDTO
  ): Promise<MarketplaceWriteoffProposalDTO> {
    const submitted = await this.service.submitToCouncil({
      id: data.draft_id,
      chairman_account: member.username,
      signed_statement: data.signed_statement,
    });
    return toMarketplaceWriteoffProposalDTO(submitted);
  }

  // ── Стол администратора: кандидаты на списание ──────────────────────

  @Query(() => [MarketplaceWriteoffCandidateDTO], {
    name: 'marketplaceListWriteoffCandidates',
    description:
      'Кандидаты на списание скоропорта: просроченные позиции на складах кооператива. Председатель выделяет нужные и создаёт из них черновик проекта списания.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'read:all')
  async marketplaceListWriteoffCandidates(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceWriteoffCandidateDTO[]> {
    return (await this.service.listCandidates(config.coopname)) as MarketplaceWriteoffCandidateDTO[];
  }

  // ── Стол ПВЗ: подтверждение списания председателем КУ ───────────────

  @Query(() => [MarketplaceWriteoffConfirmationGroupDTO], {
    name: 'marketplaceWriteoffPendingConfirmations',
    description:
      'Группы списаний, ожидающих подтверждения складом: по проекту, одобренному советом, — отдельная строка на каждый кооперативный участок. Председатель КУ видит только свои участки.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'read:own-KU')
  async marketplaceWriteoffPendingConfirmations(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceWriteoffConfirmationGroupDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];
    // Совет/админ (read:all) видят все участки; председатель КУ — только свои.
    let branames: string[] | null = null;
    if (!canAccess(roles, 'Writeoff', 'read:all')) {
      branames = await this.kuChairmanService.listBranamesForMember(coopname, member.username);
      if (branames.length === 0) return [];
    }
    return (await this.service.listPendingConfirmations(
      coopname,
      branames
    )) as MarketplaceWriteoffConfirmationGroupDTO[];
  }

  @Query(() => GeneratedDocumentDTO, {
    name: 'marketplaceWriteoffServiceMemoSignablePayload',
    description:
      'Превью Служебной записки о списании (registry 1111) по одному участку проекта — для подписания председателем КУ.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'confirm:own-KU')
  async marketplaceWriteoffServiceMemoSignablePayload(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceWriteoffServiceMemoSignablePayloadInputDTO
  ): Promise<GeneratedDocumentDTO> {
    await this.assertBranchAuthorized(member, data.braname);
    const memo = await this.service.getServiceMemoData(data.proposal_id, data.braname);
    const action: Cooperative.Registry.MarketplaceWriteoffServiceMemo.Action = {
      registry_id: Cooperative.Registry.MarketplaceWriteoffServiceMemo.registry_id,
      coopname: config.coopname,
      username: member.username,
      lang: 'ru',
      proposal_hash: memo.proposal_hash,
      braname: memo.braname,
      branch_name: memo.branch_name,
      cycle_started_at: memo.cycle_started_at,
      items: memo.items,
      total_amount: memo.total_amount,
    };
    const document = await this.documentDomainService.generateDocument({ data: action });
    return toGeneratedDocumentDTO(document);
  }

  @Mutation(() => MarketplaceWriteoffProposalDTO, {
    name: 'marketplaceConfirmWriteoff',
    description:
      'Подтвердить фактическое списание со склада участка подписанной председателем КУ Служебной запиской (registry 1111). Запускает on-chain confirmwroff по всем позициям этого участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Writeoff', 'confirm:own-KU')
  async marketplaceConfirmWriteoff(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceConfirmWriteoffInputDTO
  ): Promise<MarketplaceWriteoffProposalDTO> {
    await this.assertBranchAuthorized(member, data.braname);
    const updated = await this.service.confirmWriteoff({
      id: data.proposal_id,
      braname: data.braname,
      chairman_account: member.username,
      signed_memo: data.signed_memo,
    });
    return toMarketplaceWriteoffProposalDTO(updated);
  }

  /**
   * Проставляет позициям проектов человеко-читаемое имя КУ: в интерфейсе не
   * показываем служебный braname (правило платформы). Резолв с общим кэшем по
   * всем переданным проектам.
   */
  private async enrichItemBranchNames(dtos: MarketplaceWriteoffProposalDTO[]): Promise<void> {
    const branames = dtos.flatMap((d) => d.items.map((it) => it.braname));
    if (branames.length === 0) return;
    const names = await this.service.resolveBranchNames(branames);
    for (const d of dtos) {
      for (const it of d.items) {
        it.branch_name = names[it.braname] ?? it.braname;
      }
    }
  }

  /**
   * Гард ownership: председатель КУ может подтверждать списание только по
   * своим участкам. Админ/совет (read:all) — по любому.
   */
  private async assertBranchAuthorized(
    member: IMarketplaceCurrentMember,
    braname: string
  ): Promise<void> {
    const roles = member.marketplace_roles as MarketplaceRole[];
    if (canAccess(roles, 'Writeoff', 'read:all')) return;
    const own = await this.kuChairmanService.listBranamesForMember(config.coopname, member.username);
    if (!own.includes(braname)) {
      throw new BadRequestException(
        'Подтвердить списание можно только по участку, на котором вы являетесь председателем или доверенным лицом.'
      );
    }
  }
}
