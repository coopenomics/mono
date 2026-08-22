import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { BillingService } from '../services/billing.service';
import { BillingConvertInputDTO } from '../dto/billing-convert-input.dto';
import { BillingPayInputDTO } from '../dto/billing-pay-input.dto';
import { BillingResultDTO } from '../dto/billing-result.dto';
import { BillingSummaryDTO } from '../dto/billing-summary.dto';
import { BillingConversionStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/billing-conversion-statement-document.dto';

/**
 * GraphQL фасад billing (Epic 12 — оплата инфраструктурных подписок).
 * - `billingConvert` — пайщик конвертирует паевой взнос в членский на личный
 *   биллинг-кошелёк (`w.wal.bill`), приложив подписанное заявление (document2);
 * - `billingPay` — списание стоимости подписок с биллинг-кошелька в
 *   инфраструктурный кошелёк кооператива (оператор/председатель), идемпотентно.
 *
 * Подпись `coopname@active` (backend ретранслирует после JWT). Состав и цены
 * подписок on-chain не хранятся — они живут на стороне оператора (provider).
 */
@Resolver()
export class BillingResolver {
  constructor(private readonly service: BillingService) {}

  @Query(() => BillingSummaryDTO, {
    name: 'getBillingSummary',
    description:
      'Сумма к оплате кооператива за период (стоимость платных подписок, разбивка, ' +
      'дата следующего платежа, payment_hash). Источник — provider backend оператора. ' +
      'Для реестра кооперативов Восхода.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  getBillingSummary(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('period', { type: () => Number, nullable: true }) period?: number,
  ): Promise<BillingSummaryDTO> {
    return this.service.getBillingSummary(coopname, period ?? 30);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateBillingConversionStatement',
    description:
      'Генерирует заявление 1095.BillingConversionStatement (перед подписью пайщиком) — ' +
      'аналог generateConvertToAxonStatement, канон documents-dto.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  generateBillingConversionStatement(
    @Args('data', { type: () => BillingConversionStatementGenerateDocumentInputDTO })
    data: BillingConversionStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return this.service.generateConversionStatement(data, options);
  }

  @Mutation(() => BillingResultDTO, {
    name: 'billingConvert',
    description:
      'Конвертация паевого взноса пайщика в членский на биллинг-кошелёк (operation o.bil.fund). ' +
      'Принимает подписанное пайщиком заявление 1095.BillingConversionStatement.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user', 'member', 'chairman'])
  billingConvert(
    @Args('input', { type: () => BillingConvertInputDTO }) input: BillingConvertInputDTO,
  ): Promise<BillingResultDTO> {
    return this.service.convert(input);
  }

  @Mutation(() => BillingResultDTO, {
    name: 'billingPay',
    description:
      'Списание стоимости подписок с биллинг-кошелька пайщика в инфраструктурный ' +
      'кошелёк кооператива (operation o.bil.pay). Идемпотентно по payment_hash.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  billingPay(
    @Args('input', { type: () => BillingPayInputDTO }) input: BillingPayInputDTO,
  ): Promise<BillingResultDTO> {
    return this.service.pay(input);
  }
}
