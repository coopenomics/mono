import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import {
  AGREEMENT_QUERY_PORT,
  AgreementQueryPort,
} from '~/domain/registration/ports/agreement-query.port';

import { MARKETPLACE_OFFER_AGREEMENT_ID } from '../../constants/marketplace-agreement-ids';
import { MarketplaceRegistrationOfferStatusDTO } from '../dto/marketplace-registration-offer-status.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';

/**
 * Story 1.10: Query видимости marketplace-оферты в registration-flow.
 *
 * Открыт всем активным пайщикам (admin UI использует, чтобы рисовать
 * статус «Оферта зарегистрирована в registration-flow»).
 *
 * Запись попадает в реестр автоматически из `MarketplacePlugin.initialize`
 * (Story 1.2 + Story 1.7 — `port.registerAgreement`). Story 1.9.accept также
 * делает re-register на случай, если до установки template (Story 1.7) Plugin
 * уже отработал init и пропустил регистрацию.
 */
@Resolver()
@Injectable()
export class MarketplaceRegistrationOfferResolver {
  constructor(
    @Inject(AGREEMENT_QUERY_PORT)
    private readonly agreementQueryPort: AgreementQueryPort
  ) {}

  @Query(() => MarketplaceRegistrationOfferStatusDTO, {
    name: 'marketplaceRegistrationOfferStatus',
    description:
      'Статус видимости оферты Стола заказов в core registration-flow (платформенный AgreementRegistry)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceRegistrationOfferStatus(): Promise<MarketplaceRegistrationOfferStatusDTO> {
    const item = this.agreementQueryPort.getAgreementById(MARKETPLACE_OFFER_AGREEMENT_ID);
    if (!item) {
      return new MarketplaceRegistrationOfferStatusDTO({ registered: false });
    }
    return new MarketplaceRegistrationOfferStatusDTO({
      registered: true,
      agreement_id: item.id,
      registry_id: item.registry_id,
      agreement_type: item.agreement_type,
      title: item.title,
      applicable_account_types: item.applicable_account_types as unknown as string[],
    });
  }
}
