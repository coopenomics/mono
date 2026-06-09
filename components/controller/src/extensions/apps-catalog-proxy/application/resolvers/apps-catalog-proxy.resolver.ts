import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import {
  AppsCatalogHttpService,
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
import { PublishPackageResultDTO } from '../dto/publish-package-result.dto';
import { PublishReleaseInputDTO } from '../dto/publish-release-input.dto';
import { PublishReleaseResultDTO } from '../dto/publish-release-result.dto';
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
@Resolver()
export class AppsCatalogProxyResolver {
  private readonly logger = new Logger(AppsCatalogProxyResolver.name);

  constructor(private readonly client: AppsCatalogHttpService) {}

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
      return { status: 'applied', requestId: outcome.requestId };
    }
    if (outcome.status === 'conflict') {
      return {
        status: 'conflict',
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    return {
      status: 'failed',
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
      manifest: data.manifest,
      tarballSha256: data.tarballSha256,
    });
    if (outcome.status === 'applied') {
      this.logger.log(
        `publishRelease applied: ${data.packageId}@${data.version} (request ${outcome.requestId}, tx ${outcome.transactionId ?? '-'})`,
      );
      return {
        status: 'applied',
        requestId: outcome.requestId,
        transactionId: outcome.transactionId,
      };
    }
    if (outcome.status === 'invalidManifest') {
      return {
        status: 'invalidManifest',
        requestId: outcome.requestId,
        error: outcome.error,
      };
    }
    return {
      status: 'failed',
      requestId: outcome.requestId,
      error: outcome.error,
    };
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
}
