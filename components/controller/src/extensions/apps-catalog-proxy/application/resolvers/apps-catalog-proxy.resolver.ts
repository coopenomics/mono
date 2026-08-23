import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import {
  AppsCatalogHttpService,
  type PublisherTokenWire,
  type ModerationStatus,
  type ReleaseScopeInput,
} from '../../infrastructure/apps-catalog-http.service';
import { AppsCatalogRemotePackageDTO } from '../dto/apps-catalog-remote-package.dto';
import { ApproveModerationInputDTO } from '../dto/approve-moderation-input.dto';
import {
  ApproveModerationResultDTO,
  ApproveModerationStatus,
} from '../dto/approve-moderation-result.dto';
import {
  ModerationRequestDTO,
  ModerationStatusEnum,
  ReleaseTypeEnum,
} from '../dto/moderation-request.dto';
import { PublishPackageInputDTO } from '../dto/publish-package-input.dto';
import { PublishPackageResultDTO, PublishPackageStatus } from '../dto/publish-package-result.dto';
import {
  AppsPublisherAssignmentInputDTO,
  AppsPublisherDTO,
  IssueMyPublisherTokenInputDTO,
} from '../dto/apps-publisher.dto';
import { AppsPublishersService } from '../services/apps-publishers.service';
import type { AppsPublisherTypeormEntity } from '../../infrastructure/entities/apps-publisher.typeorm-entity';
import {
  CreatePublisherTokenResultDTO,
  CreatePublisherTokenStatus,
  PublisherTokenDTO,
  RevokePublisherTokenInputDTO,
} from '../dto/publisher-token.dto';
import { PublishReleaseInputDTO } from '../dto/publish-release-input.dto';
import { PublishReleaseResultDTO, PublishReleaseStatus } from '../dto/publish-release-result.dto';
import {
  ReleaseScopeInputDTO,
  ReleaseScopeType,
} from '../dto/release-scope-input.dto';
import { RejectModerationInputDTO } from '../dto/reject-moderation-input.dto';
import {
  RejectModerationResultDTO,
  RejectModerationStatus,
} from '../dto/reject-moderation-result.dto';
import { SubscribePackageInputDTO } from '../dto/subscribe-package-input.dto';
import {
  SubscribePackageResultDTO,
  SubscribePackageStatus,
  SubscriptionStateEnum,
} from '../dto/subscribe-package-result.dto';

const toReleaseScope = (dto: ReleaseScopeInputDTO): ReleaseScopeInput => {
  switch (dto.type) {
    case ReleaseScopeType.ALL:
      return { type: 'all' };
    case ReleaseScopeType.EMPTY:
      return { type: 'empty' };
    case ReleaseScopeType.SUBNETS: {
      const subnets = dto.subnets ?? [];
      if (subnets.length === 0) {
        throw new BadRequestException(
          'scope.type=subnets требует непустой subnets',
        );
      }
      return { type: 'subnets', subnets };
    }
    case ReleaseScopeType.COOPERATIVES: {
      const coopnames = dto.coopnames ?? [];
      if (coopnames.length === 0) {
        throw new BadRequestException(
          'scope.type=cooperatives требует непустой coopnames',
        );
      }
      return { type: 'cooperatives', coopnames };
    }
  }
};

/**
 * Story 9.5.b — публичный каталог remote-пакетов на desktop'е магазина.
 *
 * Прокси-резолвер: controller ходит к ca-admin /v1/public/packages, маппит
 * snake_case wire-формат в camelCase GraphQL-проекцию, добавляет UI-поля
 * (title/description/rubPerMonth) для витрины. В V1 description и
 * rubPerMonth — заглушки; в V2 будут читаться из package manifest и
 * apps-catalog pricing соответственно.
 *
 * Guard: GqlJwtAuthGuard — каталог видят только авторизованные пайщики
 * (по умолчанию роль `user`). Self-filter и self-sub bypass делает
 * desktop по сравнению `publisher` и текущего coopname.
 */
/** Назначение издателя → GraphQL (487-27). */
function toPublisherDTO(r: AppsPublisherTypeormEntity): AppsPublisherDTO {
  return {
    username: r.username,
    packageId: r.package_id,
    addedBy: r.added_by,
    createdAt: r.created_at.toISOString(),
  };
}

/** ca-auth snake_case → GraphQL camelCase (487-27). */
function toPublisherTokenDTO(w: PublisherTokenWire): PublisherTokenDTO {
  return {
    id: w.id,
    username: w.username,
    packageId: w.package_id,
    label: w.label,
    tokenPrefix: w.token_prefix,
    createdBy: w.created_by,
    createdAt: w.created_at,
    expiresAt: w.expires_at ?? undefined,
    revokedAt: w.revoked_at ?? undefined,
    lastUsedAt: w.last_used_at ?? undefined,
  };
}

@Resolver()
export class AppsCatalogProxyResolver {
  private readonly logger = new Logger(AppsCatalogProxyResolver.name);

  constructor(
    private readonly client: AppsCatalogHttpService,
    private readonly publishers: AppsPublishersService,
  ) {}

  @Query(() => [AppsCatalogRemotePackageDTO], {
    name: 'appsCatalogRemotePackages',
    description:
      'Список remote-пакетов из публичного каталога apps-catalog. ' +
      'Защищён JWT (видят только авторизованные пайщики). ' +
      'Источник — ca-admin /v1/public/packages; controller проксирует.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async appsCatalogRemotePackages(
    @Args('page', { type: () => Number, defaultValue: 1 }) page: number,
    @Args('pageSize', { type: () => Number, defaultValue: 50 }) pageSize: number,
  ): Promise<AppsCatalogRemotePackageDTO[]> {
    const packages = await this.client.listPublicPackages(page, pageSize);
    return packages.map((p) => ({
      packageId: p.packageId,
      publisher: p.publisher,
      compatibleSubnets: p.compatibleSubnets,
      lastActiveVersion: p.lastActiveVersion,
      title: this.buildTitle(p.packageId),
      description: this.buildDescription(p.publisher),
      rubPerMonth: 1000,
    }));
  }

  private buildTitle(packageId: string): string {
    const tail = packageId.split('/').pop() ?? packageId;
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  }

  private buildDescription(publisher: string): string {
    return `Удалённое расширение от ${publisher} — устанавливается без перезагрузки сервера.`;
  }

  /**
   * Story 9.3.b-pub — стол разработчика публикует пакет в каталоге восхода.
   *
   * Защита: только chairman кооператива-оператора (`voskhod` на dev).
   * Сама подпись on-chain `apps::regpkg` делает ca-admin от имени chairman'а
   * восхода — controller только проксирует HTTP-запрос и возвращает
   * discriminated outcome (`applied | conflict | failed`).
   *
   * Multipart upload install.js здесь НЕ делается. Под архитектуру E10
   * расширения публикуются как npm-package + docker-image в Nexus
   * отдельной процедурой (`npm publish` / `docker push`) через scoped
   * JWT от CA-auth. Эта мутация — только on-chain маркер «такой
   * пакет существует».
   */
  @Mutation(() => PublishPackageResultDTO, {
    name: 'publishPackage',
    description:
      'Регистрирует пакет on-chain (action apps::regpkg) через ca-admin. ' +
      'Подписывает chairman кооператива-оператора каталога. Доступно ' +
      'только chairman\'у (стол разработчика).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async publishPackage(
    @Args('data', { type: () => PublishPackageInputDTO })
    data: PublishPackageInputDTO,
  ): Promise<PublishPackageResultDTO> {
    const outcome = await this.client.registerPackage({
      packageId: data.packageId,
      ownerUsername: data.ownerUsername,
      compatibleSubnets: data.compatibleSubnets,
    });
    if (outcome.status === 'applied') {
      this.logger.log(
        `publishPackage applied: ${data.packageId} (request ${outcome.requestId})`,
      );
      return { status: PublishPackageStatus.APPLIED, requestId: outcome.requestId };
    }
    if (outcome.status === 'conflict') {
      return {
        status: PublishPackageStatus.CONFLICT,
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    return {
      status: PublishPackageStatus.FAILED,
      requestId: outcome.requestId,
      error: outcome.error,
    };
  }

  /**
   * Story 9.3.b-rel — стол разработчика выкладывает новый релиз пакета.
   *
   * Прокидывает manifest + версию на ca-admin `POST /v1/admin/releases`.
   * ca-admin валидирует manifest Zod-схемой и подписывает on-chain
   * `apps::setrelease` от имени chairman'а кооператива-оператора. Под
   * архитектуру E10 manifest должен содержать ссылки на артефакты в
   * Nexus (`coopenomics.backend.image` + `coopenomics.frontend.tarball`).
   */
  @Mutation(() => PublishReleaseResultDTO, {
    name: 'publishRelease',
    description:
      'Создаёт новый релиз пакета (action apps::setrelease) через ca-admin. ' +
      'Подписывает chairman кооператива-оператора каталога. Доступно ' +
      'только chairman\'у (стол разработчика).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async publishRelease(
    @Args('data', { type: () => PublishReleaseInputDTO })
    data: PublishReleaseInputDTO,
  ): Promise<PublishReleaseResultDTO> {
    const outcome = await this.client.createRelease({
      packageId: data.packageId,
      version: data.version,
      brief: data.brief,
    });
    if (outcome.status === 'applied' || outcome.status === 'queued') {
      this.logger.log(
        `publishRelease ${outcome.status}: ${data.packageId}@${data.version} (request ${outcome.requestId}, moderation ${outcome.moderationId})`,
      );
      return {
        status:
          outcome.status === 'applied'
            ? PublishReleaseStatus.APPLIED
            : PublishReleaseStatus.QUEUED,
        requestId: outcome.requestId,
        moderationId: outcome.moderationId,
      };
    }
    const statusMap: Record<typeof outcome.status, PublishReleaseStatus> = {
      notPublished: PublishReleaseStatus.NOT_PUBLISHED,
      conflict: PublishReleaseStatus.CONFLICT,
      invalidManifest: PublishReleaseStatus.INVALID_MANIFEST,
      failed: PublishReleaseStatus.FAILED,
    };
    return {
      status: statusMap[outcome.status],
      requestId: outcome.requestId,
      error: outcome.error,
    };
  }

  // ===== 487-27: издатели (председатель) =====

  @Query(() => [AppsPublisherDTO], {
    name: 'appsPublishers',
    description: 'Назначения издателей «аккаунт → пакет». Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async appsPublishers(): Promise<AppsPublisherDTO[]> {
    const rows = await this.publishers.list();
    return rows.map(toPublisherDTO);
  }

  @Mutation(() => AppsPublisherDTO, {
    name: 'addAppsPublisher',
    description:
      'Назначить пайщика издателем пакета. Дальше он сам выпускает ключ ' +
      'каталога на этот пакет со своего стола. Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addAppsPublisher(
    @Args('data', { type: () => AppsPublisherAssignmentInputDTO })
    data: AppsPublisherAssignmentInputDTO,
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<AppsPublisherDTO> {
    const row = await this.publishers.add({
      username: data.username,
      packageId: data.packageId,
      addedBy: currentUser.username,
    });
    return toPublisherDTO(row);
  }

  @Mutation(() => Boolean, {
    name: 'removeAppsPublisher',
    description: 'Снять издателя с пакета; все его ключи на пакет отзываются. Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async removeAppsPublisher(
    @Args('data', { type: () => AppsPublisherAssignmentInputDTO })
    data: AppsPublisherAssignmentInputDTO,
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<boolean> {
    return this.publishers.remove({
      username: data.username,
      packageId: data.packageId,
      removedBy: currentUser.username,
    });
  }

  // ===== 487-27: самообслуживание издателя =====

  @Query(() => [AppsPublisherDTO], {
    name: 'myPublisherPackages',
    description: 'Пакеты, издателем которых назначен текущий аккаунт.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async myPublisherPackages(
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<AppsPublisherDTO[]> {
    const rows = await this.publishers.listFor(currentUser.username);
    return rows.map(toPublisherDTO);
  }

  @Query(() => [PublisherTokenDTO], {
    name: 'myPublisherTokens',
    description: 'Мои ключи каталога (без секретов).',
  })
  @UseGuards(GqlJwtAuthGuard)
  async myPublisherTokens(
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<PublisherTokenDTO[]> {
    const items = await this.publishers.myTokens(currentUser.username);
    return items.map(toPublisherTokenDTO);
  }

  @Mutation(() => CreatePublisherTokenResultDTO, {
    name: 'issueMyPublisherToken',
    description:
      'Выпустить ключ каталога на свой пакет. Кладётся в .npmrc репозитория ' +
      'приложения; plaintext возвращается один раз.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async issueMyPublisherToken(
    @Args('data', { type: () => IssueMyPublisherTokenInputDTO })
    data: IssueMyPublisherTokenInputDTO,
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<CreatePublisherTokenResultDTO> {
    const outcome = await this.publishers.issueToken({
      username: currentUser.username,
      packageId: data.packageId,
      label: data.label,
      expiresInDays: data.expiresInDays ?? undefined,
    });
    if (outcome.status === 'created') {
      this.logger.log(
        `issueMyPublisherToken: ${currentUser.username} → ${data.packageId} (id ${outcome.record.id})`,
      );
      return {
        status: CreatePublisherTokenStatus.CREATED,
        token: outcome.token,
        record: toPublisherTokenDTO(outcome.record),
      };
    }
    return { status: CreatePublisherTokenStatus.FAILED, error: outcome.error };
  }

  @Mutation(() => Boolean, {
    name: 'revokeMyPublisherToken',
    description: 'Отозвать свой ключ каталога.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async revokeMyPublisherToken(
    @Args('data', { type: () => RevokePublisherTokenInputDTO })
    data: RevokePublisherTokenInputDTO,
    @CurrentUser() currentUser: IMonoAccount,
  ): Promise<boolean> {
    const ok = await this.publishers.revokeToken(currentUser.username, data.id);
    this.logger.log(`revokeMyPublisherToken ${data.id} by ${currentUser.username}: ${ok}`);
    return ok;
  }

  /**
   * Story 9.9 — стол восхода: список заявок на модерацию.
   *
   * Защита: chairman кооператива-оператора (voskhod). Возвращает заявки
   * в указанном статусе (по умолчанию SUBMITTED), отсортированные
   * `updatedAt` ASC (старшие — первыми).
   *
   * На degraded-mode (без APPS_CATALOG_API_KEY) — пустой массив, чтобы
   * UI стола восхода нормально показал «pending пусто».
   */
  @Query(() => [ModerationRequestDTO], {
    name: 'appsCatalogPendingModerations',
    description:
      'Заявки на модерацию пакетов в каталоге восхода. По умолчанию ' +
      'SUBMITTED (ждут approve/reject). Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async appsCatalogPendingModerations(
    @Args('status', {
      type: () => ModerationStatusEnum,
      nullable: true,
      defaultValue: ModerationStatusEnum.SUBMITTED,
    })
    status: ModerationStatusEnum,
    @Args('limit', { type: () => Number, nullable: true })
    limit?: number,
  ): Promise<ModerationRequestDTO[]> {
    const items = await this.client.listSubmittedModerations(
      status as unknown as ModerationStatus,
      limit,
    );
    return items.map((r) => ({
      id: r.id,
      packageId: r.packageId,
      version: r.version,
      scope: r.scope,
      brief: r.brief,
      releaseType: r.releaseType as ReleaseTypeEnum,
      status: r.status as unknown as ModerationStatusEnum,
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
      requiresOverride: r.requiresOverride,
    }));
  }

  /**
   * Story 9.9-approve — chairman восхода одобряет заявку на модерацию.
   *
   * Защита: только chairman кооператива-оператора (voskhod). ca-admin
   * атомарно переводит moderation в APPROVED + активирует release +
   * выкладывает outbox-event `release.activated` (он же триггер для
   * on-chain `apps::setrelease` и orchestrator'а install pipeline).
   *
   * Discriminated outcome — клиент должен switch на `status`.
   */
  @Mutation(() => ApproveModerationResultDTO, {
    name: 'approveModeration',
    description:
      'Одобряет заявку на модерацию в каталоге восхода. Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async approveModeration(
    @Args('data', { type: () => ApproveModerationInputDTO })
    data: ApproveModerationInputDTO,
  ): Promise<ApproveModerationResultDTO> {
    const outcome = await this.client.approveModeration({
      moderationId: data.moderationId,
      scope: toReleaseScope(data.scope),
      override: data.override,
    });
    if (outcome.status === 'applied') {
      this.logger.log(
        `approveModeration applied: ${outcome.packageId}@${outcome.version} (request ${outcome.requestId})`,
      );
      return {
        status: ApproveModerationStatus.APPLIED,
        requestId: outcome.requestId,
        packageId: outcome.packageId,
        version: outcome.version,
      };
    }
    if (outcome.status === 'pendingChain') {
      return {
        status: ApproveModerationStatus.PENDING_CHAIN,
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    if (outcome.status === 'conflict') {
      return {
        status: ApproveModerationStatus.CONFLICT,
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    if (outcome.status === 'requiresOverride') {
      return {
        status: ApproveModerationStatus.REQUIRES_OVERRIDE,
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    return {
      status: ApproveModerationStatus.FAILED,
      requestId: outcome.requestId,
      error: outcome.error,
    };
  }

  /**
   * Story 9.9-reject — chairman восхода отклоняет заявку.
   *
   * Защита: только chairman кооператива-оператора (voskhod). Причина
   * пишется в `status_reason` и доставляется разработчику через outbox.
   */
  @Mutation(() => RejectModerationResultDTO, {
    name: 'rejectModeration',
    description:
      'Отклоняет заявку на модерацию с причиной. Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async rejectModeration(
    @Args('data', { type: () => RejectModerationInputDTO })
    data: RejectModerationInputDTO,
  ): Promise<RejectModerationResultDTO> {
    const outcome = await this.client.rejectModeration({
      moderationId: data.moderationId,
      reason: data.reason,
    });
    if (outcome.status === 'applied') {
      this.logger.log(
        `rejectModeration applied: ${data.moderationId} (request ${outcome.requestId})`,
      );
      return {
        status: RejectModerationStatus.APPLIED,
        requestId: outcome.requestId,
      };
    }
    if (outcome.status === 'conflict') {
      return {
        status: RejectModerationStatus.CONFLICT,
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    return {
      status: RejectModerationStatus.FAILED,
      requestId: outcome.requestId,
      error: outcome.error,
    };
  }

  /**
   * Story 9.3.b-sub — пайщик подписывает свой кооператив на пакет.
   *
   * Защита: только chairman кооператива-партнёра. ca-auth активирует
   * подписку tenant'а (кооператива пайщика читается из tenant JWT, не
   * из body), on-chain `apps::regsub` подписывает ca-auth от имени
   * каталога-оператора. После активации pricing-watcher на coopback
   * партнёра подхватит подписку и начнёт списания (см. story 9.6).
   *
   * Discriminated outcome:
   *  - `activated` — подписка ACTIVE/trial;
   *  - `alreadyActive` — у кооператива уже есть подписка;
   *  - `clientNotRegistered` — кооператив не в каталоге (нужен onboarding);
   *  - `unavailable` — каталог временно недоступен;
   *  - `failed` — прочие ошибки.
   */
  @Mutation(() => SubscribePackageResultDTO, {
    name: 'subscribePackage',
    description:
      'Подписывает кооператив-партнёр на пакет из каталога восхода. ' +
      'Tenant читается из server-side JWT, body не может его переопределить. ' +
      'Только chairman кооператива-партнёра.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async subscribePackage(
    @Args('data', { type: () => SubscribePackageInputDTO })
    data: SubscribePackageInputDTO,
  ): Promise<SubscribePackageResultDTO> {
    const outcome = await this.client.activateSubscription({
      packageId: data.packageId,
      plan: data.plan,
    });
    if (outcome.status === 'activated') {
      this.logger.log(
        `subscribePackage activated: ${outcome.packageId} (state ${outcome.state}, до ${outcome.endAt})`,
      );
      return {
        status: SubscribePackageStatus.ACTIVATED,
        state: outcome.state as unknown as SubscriptionStateEnum,
        packageId: outcome.packageId,
        plan: outcome.plan,
        startAt: outcome.startAt,
        endAt: outcome.endAt,
        freeTrialUsed: outcome.freeTrialUsed,
      };
    }
    if (outcome.status === 'alreadyActive') {
      return {
        status: SubscribePackageStatus.ALREADY_ACTIVE,
        error: outcome.error,
      };
    }
    if (outcome.status === 'clientNotRegistered') {
      return {
        status: SubscribePackageStatus.CLIENT_NOT_REGISTERED,
        error: outcome.error,
      };
    }
    if (outcome.status === 'unavailable') {
      return {
        status: SubscribePackageStatus.UNAVAILABLE,
        error: outcome.error,
      };
    }
    return {
      status: SubscribePackageStatus.FAILED,
      error: outcome.error,
    };
  }
}
