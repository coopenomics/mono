import { Inject, Injectable } from '@nestjs/common';

import { AGREEMENT_REPOSITORY, AgreementRepository } from '~/domain/agreement/repositories/agreement.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
} from '../../constants/marketplace-agreement-ids';
import type { MarketplaceOnboardingSource } from '../dto/marketplace-onboarding-state.dto';
import { MarketplaceOnboardingStateDTO } from '../dto/marketplace-onboarding-state.dto';

/**
 * Story 1.4: L3 fallback gate marketplace.
 *
 * Контракт: расширение само не хранит «подписал/не подписал». Источник правды —
 * `soviet::agreements3`, синхронизированная в `AgreementRepository` через
 * `AgreementSyncService` (см. CLAUDE.md read-path: только PG-repository).
 *
 * Локальная таблица `marketplace_onboarding_state` из PRD не заводится:
 * - `AgreementRepository.findByUsername` уже даёт быстрый доступ к подписям
 *   (PG индекс по username);
 * - различение source ('registration_flow' vs 'extension_gate') в текущей
 *   `agreements3` отсутствует — оба пути пишут одинаковую запись с
 *   `agreement_type = 'marketplace'`. Story 1.11 при добавлении L2 при
 *   необходимости заведёт локальный source-маркер.
 *
 * TTL 60s из PRD AC тоже опускаем — `AgreementRepository` сам синхронизирован
 * с blockchain, локальный staleness ничем не отличается от core data.
 */
@Injectable()
export class MarketplaceOnboardingService {
  constructor(
    @Inject(AGREEMENT_REPOSITORY) private readonly agreementRepository: AgreementRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceOnboardingService.name);
  }

  async getOnboardingState(username: string): Promise<MarketplaceOnboardingStateDTO> {
    const templateRegistryId = MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID;

    if (templateRegistryId <= 0) {
      // Story 1.7 не выполнена — нечего показывать в gate, фронт пропускает.
      return new MarketplaceOnboardingStateDTO({
        requires_gate: false,
        source: 'not_configured',
        template_registry_id: 0,
      });
    }

    const agreements = await this.agreementRepository.findByUsername(username);
    const signed = agreements.find(
      (a) =>
        a.type === MARKETPLACE_AGREEMENT_TYPE &&
        (a.draft_id === undefined ||
          a.draft_id === null ||
          Number(a.draft_id) === templateRegistryId)
    );

    if (signed) {
      const source: MarketplaceOnboardingSource = 'agreement_signed';
      return new MarketplaceOnboardingStateDTO({
        requires_gate: false,
        source,
        template_registry_id: templateRegistryId,
        completed_at: signed.updated_at ? String(signed.updated_at) : undefined,
        agreement_id: signed.id ?? undefined,
      });
    }

    return new MarketplaceOnboardingStateDTO({
      requires_gate: true,
      source: 'gate_required',
      template_registry_id: templateRegistryId,
    });
  }
}

export const MARKETPLACE_ONBOARDING_SERVICE = Symbol('MARKETPLACE_ONBOARDING_SERVICE');
