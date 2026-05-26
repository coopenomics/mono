import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_BLOCKCHAIN_PORT,
  type BillingBlockchainPort,
} from '~/domain/billing/ports/billing-blockchain.port';
import type { BillingConvertInputDTO } from '../dto/billing-convert-input.dto';
import type { BillingPayInputDTO } from '../dto/billing-pay-input.dto';
import type { BillingResultDTO } from '../dto/billing-result.dto';

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
  ) {}

  async convert(input: BillingConvertInputDTO): Promise<BillingResultDTO> {
    const result = await this.blockchainPort.convert({
      coopname: input.coopname,
      username: input.username,
      quantity: input.amount,
      document: input.document.toDocument(),
    });
    return { transactionId: this.extractTransactionId(result) };
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
      transactionId: this.extractTransactionId(result),
      paymentHash: input.paymentHash,
    };
  }

  private extractTransactionId(result: unknown): string {
    if (result && typeof result === 'object' && 'transaction_id' in result) {
      const tx = (result as { transaction_id?: unknown }).transaction_id;
      if (typeof tx === 'string') return tx;
    }
    if (result && typeof result === 'object' && 'response' in result) {
      const resp = (result as { response?: { transaction_id?: unknown } }).response;
      if (resp && typeof resp.transaction_id === 'string') return resp.transaction_id;
    }
    return '';
  }
}
