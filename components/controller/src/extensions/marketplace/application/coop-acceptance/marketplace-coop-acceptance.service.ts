import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';

import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  AGREEMENT_REGISTRATION_PORT,
  AgreementRegistrationPort,
} from '~/domain/registration/ports/agreement-registration.port';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import { MARKETPLACE_EXTENSION_NAME } from '../../constants/marketplace-agreement-ids';
import { registerMarketplaceInAgreementRegistry } from '../registration/register-marketplace-in-agreement-registry';
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
 * `marketplace`-расширении). MVP-stub: председатель сам отмечает принятие
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
    private readonly logger: WinstonLoggerService,
    // Story 1.10: side-effect — re-register marketplace-оферту в core
    // AgreementRegistry после accept. Идемпотентно: AgreementRegistryService
    // не дублирует записи по (id, extension_name). @Optional для unit-тестов
    // Story 1.9, которые тестируют только accept без агрегата registration.
    @Optional()
    @Inject(AGREEMENT_REGISTRATION_PORT)
    private readonly agreementRegistrationPort?: AgreementRegistrationPort
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

    const now = new Date();
    const accepted_at = input.accepted_at ?? now.toISOString();
    if (input.accepted_at) {
      const parsed = new Date(input.accepted_at);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          `Некорректный формат accepted_at: '${input.accepted_at}' — ожидается ISO-8601`
        );
      }
      if (parsed.getTime() > now.getTime() + 60_000) {
        throw new BadRequestException(
          `accepted_at не может быть в будущем (${input.accepted_at})`
        );
      }
    }
    const acceptance: ICoopAcceptanceConfig = {
      accepted: true,
      document_registry_id: input.document_registry_id,
      accepted_at,
      accepted_by_board_decision_id: input.accepted_by_board_decision_id,
    };

    // Атомарный merge только своего ключа: не затираем соседние поля config
    // (onboarding_*_done и т.п.), которые мог проставить generic-слушатель
    // решений совета параллельно.
    await this.extensionRepository.patchConfig(MARKETPLACE_EXTENSION_NAME, {
      coopAcceptance: acceptance,
    });

    this.logger.info(
      `[MARKETPLACE.L1] Положение ЦПП принято: document_registry_id=${input.document_registry_id}, board_decision_id=${input.accepted_by_board_decision_id}, accepted_at=${accepted_at}`
    );

    // Story 1.10 side-effect: re-register оферту в core AgreementRegistry
    // (идемпотентно). Покрывает кейс, когда Story 1.7 поставила template
    // позже restart-а расширения и `MarketplaceExtension.initialize` пропустил
    // регистрацию (placeholder=0).
    if (this.agreementRegistrationPort) {
      try {
        const ok = registerMarketplaceInAgreementRegistry(this.agreementRegistrationPort);
        if (ok) {
          this.logger.info('[MARKETPLACE.L1] оферта re-registered в core AgreementRegistry');
        } else {
          this.logger.warn(
            '[MARKETPLACE.L1] re-register пропущен (MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0)'
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[MARKETPLACE.L1] re-register failed: ${message}`);
      }
    }

    return {
      status: 'active',
      document_registry_id: acceptance.document_registry_id,
      accepted_at: acceptance.accepted_at,
      accepted_by_board_decision_id: acceptance.accepted_by_board_decision_id,
    };
  }
}
