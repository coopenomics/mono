import { Field, InputType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/**
 * Эпик 1 / Story 1.4 (фоллоуап) — input mutation `marketplaceSignOnboardingOffer`.
 *
 * Контекст:
 *  - `coopname` и `username` НЕ принимаются с фронта — берутся из
 *    `MarketplaceMembershipGuard` (JWT-пайщик), чтобы исключить подделку
 *    подписи за другого пайщика.
 *  - `document` — уже подписанный фронтом инстанс оферты ЦПП «Стол заказов»
 *    (`Cooperative.Registry.MarketplaceOffer`). Backend проверяет подпись через on-chain
 *    `verify_document_or_fail` внутри `wallet::signagree`.
 */
@InputType('MarketplaceSignOnboardingOfferInput')
export class MarketplaceSignOnboardingOfferInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанная пайщиком оферта ЦПП «Стол заказов»',
  })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
