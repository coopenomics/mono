import { Field, InputType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * Эпик 1 / Story 1.4 (фоллоуап) — input mutation `marketplaceSignOnboardingOffer`.
 *
 * Контекст:
 *  - `coopname` и `username` НЕ принимаются с фронта — берутся из
 *    `MarketplaceMembershipGuard` (JWT-пайщик), чтобы исключить подделку
 *    подписи за другого пайщика.
 *  - `document` — уже подписанный фронтом инстанс оферты ЦПП «Стол заказов»
 *    (`registry_id=1101`). Backend проверяет подпись через on-chain
 *    `verify_document_or_fail` внутри `wallet::signagree`.
 */
@InputType('MarketplaceSignOnboardingOfferInput')
export class MarketplaceSignOnboardingOfferInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный пайщиком инстанс оферты ЦПП «Стол заказов» (registry_id=1101)',
  })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
