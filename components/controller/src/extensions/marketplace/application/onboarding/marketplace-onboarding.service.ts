import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { LOGGER_PORT, type ILoggerPort,
  type InnerTransactResult,
  COUNCIL_PORT,
  type ICouncilPort,
  PROGRAM_AGREEMENT_PORT,
  type IProgramAgreementPort,
} from '@coopenomics/innercoop';
import type { ISignedDocument } from '@coopenomics/innercoop';

import {
  MARKETPLACE_AGREEMENT_TYPE,
  MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID,
} from '../../constants/marketplace-agreement-ids';
import { MarketplaceOnboardingSource, MarketplaceOnboardingStateDTO } from '../dto/marketplace-onboarding-state.dto';
import { platformSettings } from '@coopenomics/extension-kit';

/**
 * Story 1.4: L3 fallback gate marketplace.
 *
 * Контракт: расширение само не хранит «подписал/не подписал». Источник правды —
 * блокчейн, синхронизированный в PG (read-path: только PG-repository).
 *
 * ВАЖНО — правильный источник: ЦПП «Стол заказов» это ПРОГРАММА (program_id=2),
 * и подпись пайщика делается через `wallet::signagree` в `wallet::users.programs[]`,
 * а НЕ в `soviet::agreements3`. Поэтому состояние читаем из
 * `IProgramAgreementPort` (синк `user-agreement-sync.service` из `wallet::users`),
 * а не из `AgreementRepository` (синк `agreement-sync.service` из `agreements3`).
 * Это тот же канон, что в `AgreementService.fetchProgrammatic`. Раньше здесь
 * читался `AgreementRepository`, куда программная подпись НИКОГДА не попадает —
 * из-за чего `requires_gate` оставался `true` навсегда после подписи.
 *
 * Локальная таблица `marketplace_onboarding_state` из PRD не заводится:
 * быстрый доступ уже даёт PG-кеш `wallet::users`. TTL 60s из PRD AC опускаем —
 * репозиторий синхронизирован с blockchain, локальный staleness не отличается
 * от core data.
 */
@Injectable()
export class MarketplaceOnboardingService {
  constructor(
    @Inject(PROGRAM_AGREEMENT_PORT) private readonly programAgreements: IProgramAgreementPort,
    @Inject(COUNCIL_PORT) private readonly sovietBlockchainPort: ICouncilPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceOnboardingService.name);
  }

  async getOnboardingState(username: string): Promise<MarketplaceOnboardingStateDTO> {
    const templateRegistryId = MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID;

    if (templateRegistryId <= 0) {
      // Шаблона оферты нет — подписывать нечего. Это состояние кооператива:
      // потребитель обязан развести его с «подписал» по source (см. enum).
      return new MarketplaceOnboardingStateDTO({
        requires_gate: false,
        source: MarketplaceOnboardingSource.NOT_CONFIGURED,
        template_registry_id: 0,
      });
    }

    // program_id ЦПП «Стол заказов» из `soviet::coagreements` (тот же лукап, что
    // и при подписи). Пока программа в кооперативе не создана, подписать оферту
    // физически невозможно (`wallet::signagree` упадёт «Программа не найдена»),
    // поэтому это НЕ «подписи не требуется», а «кооператив не завершил
    // подключение ЦПП» — инцидент 2026-08-10.
    const coopname = platformSettings().coopname;
    const coagreement = await this.sovietBlockchainPort.getCoagreement(
      coopname,
      MARKETPLACE_AGREEMENT_TYPE
    );
    const programId = coagreement ? Number(coagreement.program_id) : 0;
    if (!coagreement || programId <= 0) {
      return new MarketplaceOnboardingStateDTO({
        requires_gate: false,
        source: MarketplaceOnboardingSource.NOT_CONFIGURED,
        template_registry_id: templateRegistryId,
      });
    }

    // Подпись программной оферты хранит ядро; порт отвечает, есть ли она.
    const program = await this.programAgreements.findProgramSignature(coopname, username, programId);

    if (program) {
      return new MarketplaceOnboardingStateDTO({
        requires_gate: false,
        source: MarketplaceOnboardingSource.AGREEMENT_SIGNED,
        template_registry_id: templateRegistryId,
        completed_at: program.signed_at ? String(program.signed_at) : undefined,
      });
    }

    return new MarketplaceOnboardingStateDTO({
      requires_gate: true,
      source: MarketplaceOnboardingSource.GATE_REQUIRED,
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
   *  1. Лукап `soviet::coagreements(coopname, type='marketplace')` → program_id
   *     (2 по `program_map` контракта).
   *  2. Лукап `soviet::programs[program_id]` → draft_id подписываемого шаблона
   *     (1102, персональный инстанс оферты). Источник именно программа — см.
   *     комментарий в теле метода.
   *  3. `walletBlockchainPort.signProgramAgreement` → on-chain
   *     `wallet::signagree` пишет запись в `wallet::users.programs[]` с
   *     program_id=2. После next-block `UserAgreementSyncService` подтягивает
   *     запись в PG-кеш, и следующий `getOnboardingState` вернёт
   *     `requires_gate=false, source=AGREEMENT_SIGNED`.
   *
   * Auth: вызывающий = пайщик (JWT в `MarketplaceMembershipGuard`).
   * `coopname` берётся из guard'а, `username` тоже — фронт не передаёт.
   */
  async signOnboardingOffer(input: {
    coopname: string;
    username: string;
    document: ISignedDocument;
  }): Promise<InnerTransactResult> {
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

    // Шаблон подписи берём из самой программы, а не из `coagreements`:
    // `wallet::signagree` сверяет присланный draft_id именно с
    // `soviet::programs[program_id].draft_id`. Значения расходятся, когда
    // шаблон программы правили через `soviet::editprog` — тот меняет
    // `programs`, но не `coagreements`. Взяли бы из coagreement — подпись
    // падала бы «draft_id соглашения не совпадает с draft_id программы».
    const programs = await this.sovietBlockchainPort.getPrograms(input.coopname);
    const program = programs.find((p) => Number(p.id) === programId);
    if (!program) {
      throw new BadRequestException(
        `Программа ЦПП «Стол заказов» (program_id=${programId}) не найдена в кооперативе '${input.coopname}': кооператив не завершил подключение ЦПП`
      );
    }
    const draftId = Number(program.draft_id);

    this.logger.info(
      `[MARKETPLACE.L3] signOnboardingOffer → wallet::signagree (${input.coopname}/${input.username} program_id=${programId} draft_id=${draftId})`
    );

    return await this.programAgreements.signProgramAgreement({
      coopname: input.coopname,
      username: input.username,
      program_id: programId,
      draft_id: draftId,
      document: input.document,
    });
  }
}

export const MARKETPLACE_ONBOARDING_SERVICE = Symbol('MARKETPLACE_ONBOARDING_SERVICE');
