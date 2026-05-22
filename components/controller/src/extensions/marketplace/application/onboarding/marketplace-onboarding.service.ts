import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { TransactResult } from '@wharfkit/session';

import { AGREEMENT_REPOSITORY, AgreementRepository } from '~/domain/agreement/repositories/agreement.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import { WALLET_BLOCKCHAIN_PORT, WalletBlockchainPort } from '~/domain/wallet/ports/wallet-blockchain.port';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

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
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort,
    @Inject(WALLET_BLOCKCHAIN_PORT) private readonly walletBlockchainPort: WalletBlockchainPort,
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

  /**
   * Эпик 1 фоллоуап: L3 sign-mutation.
   *
   * Pole-position: пайщик зарегистрировался **до** активации marketplace
   * (Story 1.7/1.9 ещё не прошли) или не выбрал ЦПП «Стол заказов» на
   * core registration-flow (L2). Сейчас при первом входе на стол получает
   * gate (Story 1.4). Этот метод позволяет ему подписать оферту прямо со
   * стола, без повторной регистрации.
   *
   * Flow:
   *  1. Лукап `soviet::coagreements(coopname, type='marketplace')` →
   *     program_id (должен быть 2) + draft_id (должен быть 1100).
   *  2. `walletBlockchainPort.signProgramAgreement` → on-chain
   *     `wallet::signagree` пишет запись в `wallet::users.programs[]` с
   *     program_id=2. После next-block `AgreementSyncService` подтягивает
   *     запись в PG-кеш `AgreementRepository`, и следующий
   *     `getOnboardingState` вернёт `requires_gate=false,
   *     source='agreement_signed'`.
   *
   * Auth: вызывающий = пайщик (JWT в `MarketplaceMembershipGuard`).
   * `coopname` берётся из guard'а, `username` тоже — фронт не передаёт.
   */
  async signOnboardingOffer(input: {
    coopname: string;
    username: string;
    document: ISignedDocumentDomainInterface;
  }): Promise<TransactResult> {
    if (MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID <= 0) {
      throw new BadRequestException(
        'ЦПП «Стол заказов» ещё не активирована (Story 1.7 не выполнена): подписание оферты невозможно'
      );
    }

    const coagreement = await this.sovietBlockchainPort.getCoagreement(
      input.coopname,
      MARKETPLACE_AGREEMENT_TYPE
    );
    if (!coagreement) {
      throw new BadRequestException(
        `В кооперативе '${input.coopname}' не настроено соглашение типа '${MARKETPLACE_AGREEMENT_TYPE}' (выполните Story 1.9 / marketplaceAcceptCpp)`
      );
    }
    const programId = Number(coagreement.program_id);
    if (programId <= 0) {
      throw new BadRequestException(
        `Соглашение '${MARKETPLACE_AGREEMENT_TYPE}' в кооперативе '${input.coopname}' не имеет программного wallet'а (program_id=${programId}): подписание через wallet::signagree невозможно`
      );
    }

    this.logger.info(
      `[MARKETPLACE.L3] signOnboardingOffer → wallet::signagree (${input.coopname}/${input.username} program_id=${programId} draft_id=${coagreement.draft_id})`
    );

    return await this.walletBlockchainPort.signProgramAgreement({
      coopname: input.coopname,
      username: input.username,
      program_id: programId,
      draft_id: Number(coagreement.draft_id),
      document: input.document,
    });
  }
}

export const MARKETPLACE_ONBOARDING_SERVICE = Symbol('MARKETPLACE_ONBOARDING_SERVICE');
