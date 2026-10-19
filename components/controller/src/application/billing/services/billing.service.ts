import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import { BillingProviderClient } from '~/infrastructure/billing/billing-provider.client';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { AmountFormatterUtils, DomainToBlockchainUtils, GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { TransactionUtils } from '~/shared/utils/transaction.utils';
import { Cooperative } from 'cooptypes';
import { BillingConversionStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/billing-conversion-statement-document.dto';
import type { BillingConvertInputDTO } from '../dto/billing-convert-input.dto';
import type { BillingPayInputDTO } from '../dto/billing-pay-input.dto';
import type { BillingResultDTO } from '../dto/billing-result.dto';
import type { BillingSummaryDTO } from '../dto/billing-summary.dto';

/**
 * Application-сервис billing (Epic 12). Тонкий фасад: валидацию входа делают
 * class-validator-декораторы DTO, согласие пайщика (для convert) и presence-check
 * кооператива проверяет on-chain сам контракт `billing`. Сервис делегирует подпись
 * и отправку в blockchain-порт (`coopname@active`, WIF из vault).
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_BLOCKCHAIN_PORT) private readonly blockchainPort: BillingBlockchainPort,
    private readonly providerClient: BillingProviderClient,
    private readonly documentDomainService: DocumentDomainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
  ) {}

  /**
   * Генерирует заявление 1095.BillingConversionStatement — подписывает пайщик
   * на стороне desktop перед `billingConvert`. Канон: provider.service →
   * generateConvertToAxonStatement.
   */
  async generateConversionStatement(
    data: BillingConversionStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    data.registry_id = Cooperative.Registry.BillingConversionStatement.registry_id;
    data.convert_amount = AmountFormatterUtils.formatAmount(data.convert_amount);
    const document = await this.documentDomainService.generateDocument({ data, options });
    return document as unknown as GeneratedDocumentDTO;
  }

  /**
   * Сумма к оплате кооператива за период — проекция provider getBillingSummary
   * для реестра кооперативов (сумма/дата след. платежа/free-метки/payment_hash).
   */
  async getBillingSummary(coopname: string, periodDays = 30): Promise<BillingSummaryDTO> {
    const s = await this.providerClient.getBillingSummary(coopname, periodDays);
    return {
      coopname: s.coopname,
      periodDays: s.period_days,
      totalAmount: s.total_amount,
      currency: s.currency,
      paymentHash: s.payment_hash,
      nextPaymentDue: s.next_payment_due,
      items: (s.items ?? []).map((i) => ({
        subscriptionId: i.subscription_id,
        subscriptionTypeId: i.subscription_type_id,
        subscriptionTypeName: i.subscription_type_name,
        status: i.status,
        amount: i.amount,
        isFree: i.is_free,
      })),
    };
  }

  async convert(input: BillingConvertInputDTO): Promise<BillingResultDTO> {
    const result = await this.blockchainPort.convert({
      coopname: input.coopname,
      username: input.username,
      quantity: input.amount,
      document: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(input.document),
    });
    return { transactionId: TransactionUtils.extractTransactionId(result) };
  }

  async pay(input: BillingPayInputDTO): Promise<BillingResultDTO> {
    const result = await this.blockchainPort.pay({
      coopname: input.coopname,
      username: input.username,
      quantity: input.amount,
      paymentHash: input.paymentHash,
      memo: input.memo,
    });
    return {
      transactionId: TransactionUtils.extractTransactionId(result),
      paymentHash: input.paymentHash,
    };
  }
}
