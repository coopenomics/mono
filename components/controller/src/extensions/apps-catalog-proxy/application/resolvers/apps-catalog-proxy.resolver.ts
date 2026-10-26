import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RightsGuard, RequireRight, CurrentUser } from '@coopenomics/extension-kit';
import { type IMonoAccount } from '@coopenomics/innercoop';
import { t } from '../../i18n';
import {
  AppsCatalogHttpService,
  type PublisherTokenWire,
  type ModerationStatus,
  type ReleaseScopeInput,
} from '../../infrastructure/apps-catalog-http.service';
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
import type { AppsPublisherRecord } from '../../infrastructure/records/apps-publisher.record';
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
          t('appsCatalogProxy.scope.subnetsRequired'),
        );
      }
      return { type: 'subnets', subnets };
    }
    case ReleaseScopeType.COOPERATIVES: {
      const coopnames = dto.coopnames ?? [];
      if (coopnames.length === 0) {
        throw new BadRequestException(
          t('appsCatalogProxy.scope.cooperativesRequired'),
        );
      }
      return { type: 'cooperatives', coopnames };
    }
  }
};

/**
 * Story 9.5.b — публичный каталог remote-пакетов на desktop'е магазина.
 *
 * Прокси-резолвер: controller ходит к catalog-operator /v1/public/packages, маппит
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
function toPublisherDTO(r: AppsPublisherRecord): AppsPublisherDTO {
  return {
    username: r.username,
    packageId: r.packageId,
    addedBy: r.addedBy,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

/** catalog-delivery snake_case → GraphQL camelCase (487-27). */
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

  /**
   * Story 9.3.b-pub — стол разработчика публикует пакет в каталоге восхода.
   *
   * Защита: только chairman кооператива-оператора (`voskhod` на dev).
   * Запись пакета в базу каталога делает catalog-operator от имени chairman'а
   * восхода — controller только проксирует HTTP-запрос и возвращает
   * discriminated outcome (`applied | conflict | failed`).
   *
   * Multipart upload install.js здесь НЕ делается. Под архитектуру E10
   * расширения публикуются как npm-package + docker-image в Nexus
   * отдельной процедурой (`npm publish` / `docker push`) через scoped
   * JWT от catalog-delivery. Эта мутация — только запись в каталоге «такой
   * пакет существует».
   */
  @Mutation(() => PublishPackageResultDTO, {
    name: 'publishPackage',
    description:
      'Регистрирует пакет в каталоге приложений через catalog-operator. ' +
      'Подписывает chairman кооператива-оператора каталога. Доступно ' +
      'только chairman\'у (стол разработчика).',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
   * Прокидывает manifest + версию на catalog-operator `POST /v1/admin/releases`.
   * catalog-operator валидирует manifest Zod-схемой и записывает выпуск в базу
   * каталога от имени chairman'а кооператива-оператора. Под
   * архитектуру E10 manifest должен содержать ссылки на артефакты в
   * Nexus (`coopenomics.backend.image` + `coopenomics.frontend.tarball`).
   */
  @Mutation(() => PublishReleaseResultDTO, {
    name: 'publishRelease',
    description:
      'Создаёт новый релиз пакета в каталоге приложений через catalog-operator. ' +
      'Подписывает chairman кооператива-оператора каталога. Доступно ' +
      'только chairman\'у (стол разработчика).',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
   * На degraded-mode (без APPS_CATALOG_OPERATOR_API_KEY) — пустой массив, чтобы
   * UI стола восхода нормально показал «pending пусто».
   */
  @Query(() => [ModerationRequestDTO], {
    name: 'appsCatalogPendingModerations',
    description:
      'Заявки на модерацию пакетов в каталоге восхода. По умолчанию ' +
      'SUBMITTED (ждут approve/reject). Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
   * Защита: только chairman кооператива-оператора (voskhod). catalog-operator
   * атомарно переводит moderation в APPROVED + активирует release +
   * выкладывает outbox-event `release.activated` (он же триггер для
   * записи выпуска в базе каталога и установки оркестратором).
   *
   * Discriminated outcome — клиент должен switch на `status`.
   */
  @Mutation(() => ApproveModerationResultDTO, {
    name: 'approveModeration',
    description:
      'Одобряет заявку на модерацию в каталоге восхода. Только chairman.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Developer', 'manage')
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

}
