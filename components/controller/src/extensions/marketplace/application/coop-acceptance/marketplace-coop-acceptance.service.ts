import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import { MARKETPLACE_EXTENSION_NAME } from '../../constants/marketplace-agreement-ids';
import type { IConfig, ICoopAcceptanceConfig } from '../../types';
import { defaultConfig } from '../../types';

export interface IMarketplaceCppStatus {
  status: 'active' | 'not_accepted';
  document_registry_id?: number;
  accepted_at?: string;
  accepted_by_board_decision_id?: string;
}

export interface IAcceptCppInput {
  document_registry_id: number;
  accepted_by_board_decision_id: string;
  /**
   * ISO-8601 timestamp решения. Опционально — если не передан, берётся
   * текущее время сервера (чистая функция от input + clock).
   */
  accepted_at?: string;
}

/**
 * Story 1.9: L1-онбординг marketplace.
 *
 * Хранит флаг `coopAcceptance.accepted` в `extensions.config` (JSONB на
 * `marketplace`-плагине). MVP-stub: председатель сам отмечает принятие
 * положения Советом, передавая `accepted_by_board_decision_id`. В Эпике 8
 * (FR40 «повестка совета») интеграция станет реальной — Mutation будет
 * валидировать существование решения и его статус CONFIRMED.
 *
 * Resolver вызывает `accept` под `MarketplaceRoleGuard` с
 * `@RequireMarketplaceAccess('Extension', 'configure')` — это admin-only.
 *
 * Side-effect: после `accept` Story 1.10 регистрирует marketplace-оферту в
 * `coop_registration_offers_registry` (отдельный сервис, может слушать
 * событие или дёргается ручкой из admin UI).
 */
@Injectable()
export class MarketplaceCoopAcceptanceService {
  constructor(
    @Inject(EXTENSION_REPOSITORY)
    private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceCoopAcceptanceService.name);
  }

  async getStatus(): Promise<IMarketplaceCppStatus> {
    const extension = await this.extensionRepository.findByName(MARKETPLACE_EXTENSION_NAME);
    if (!extension) {
      throw new NotFoundException(
        `Расширение '${MARKETPLACE_EXTENSION_NAME}' не установлено — выполните Story 1.1 (install)`
      );
    }

    const acceptance: ICoopAcceptanceConfig =
      extension.config?.coopAcceptance ?? defaultConfig.coopAcceptance;

    if (!acceptance.accepted) {
      return { status: 'not_accepted' };
    }

    return {
      status: 'active',
      document_registry_id: acceptance.document_registry_id || undefined,
      accepted_at: acceptance.accepted_at || undefined,
      accepted_by_board_decision_id: acceptance.accepted_by_board_decision_id || undefined,
    };
  }

  async accept(input: IAcceptCppInput): Promise<IMarketplaceCppStatus> {
    const extension = await this.extensionRepository.findByName(MARKETPLACE_EXTENSION_NAME);
    if (!extension) {
      throw new NotFoundException(
        `Расширение '${MARKETPLACE_EXTENSION_NAME}' не установлено — выполните Story 1.1 (install)`
      );
    }

    const accepted_at = input.accepted_at ?? new Date().toISOString();
    const acceptance: ICoopAcceptanceConfig = {
      accepted: true,
      document_registry_id: input.document_registry_id,
      accepted_at,
      accepted_by_board_decision_id: input.accepted_by_board_decision_id,
    };

    const nextConfig: IConfig = {
      ...defaultConfig,
      ...(extension.config ?? {}),
      coopAcceptance: acceptance,
    };

    await this.extensionRepository.update({ name: MARKETPLACE_EXTENSION_NAME, config: nextConfig });

    this.logger.info(
      `[MARKETPLACE.L1] Положение ЦПП принято: document_registry_id=${input.document_registry_id}, board_decision_id=${input.accepted_by_board_decision_id}, accepted_at=${accepted_at}`
    );

    return {
      status: 'active',
      document_registry_id: acceptance.document_registry_id,
      accepted_at: acceptance.accepted_at,
      accepted_by_board_decision_id: acceptance.accepted_by_board_decision_id,
    };
  }
}
