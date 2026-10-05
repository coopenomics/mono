import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { PaymentFilesService } from '../services/payment-files.service';
import { UploadPaymentProofInputDTO } from '../dto/upload-payment-proof.input';
import { PaymentFileOutputDTO } from '../dto/payment-file.output';

/**
 * GraphQL для чеков об оплате платежей (ядро gateway).
 *
 * - Прикладывает чек кассир (chairman/member) — подтверждение исполненной оплаты.
 * - Списки и read-URL видят те же роли и пайщик (свой чек). ACL уточнится после E2E.
 */
@Resolver(() => PaymentFileOutputDTO)
export class PaymentFilesResolver {
  constructor(private readonly paymentFiles: PaymentFilesService) {}

  @Mutation(() => PaymentFileOutputDTO, {
    name: 'uploadPaymentProof',
    description: 'Приложить чек об оплате к платежу (бакет gateway:files).',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('PaymentFile', 'upload')
  async uploadPaymentProof(
    @Args('data', { type: () => UploadPaymentProofInputDTO }) data: UploadPaymentProofInputDTO,
    @CurrentUser() user: IMonoAccount
  ): Promise<PaymentFileOutputDTO> {
    const { data: saved, readUrl } = await this.paymentFiles.uploadProof(data, user.username);
    return PaymentFileOutputDTO.fromDomain(saved, readUrl);
  }

  @Query(() => PaymentFileOutputDTO, {
    name: 'paymentFile',
    description: 'Получить запись о файле платежа + свежий короткоживущий read-URL.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('PaymentFile', ['read:own', 'read:all'], { of: 'PaymentFile', id: 'id' })
  async getPaymentFile(
    @Args('id', { type: () => Int }) id: number
  ): Promise<PaymentFileOutputDTO> {
    const { data, readUrl } = await this.paymentFiles.getReadUrl(id);
    return PaymentFileOutputDTO.fromDomain(data, readUrl);
  }

  @Query(() => [PaymentFileOutputDTO], {
    name: 'paymentProofs',
    description: 'Список чеков об оплате платежа (без read-URL — запрос отдельно по id).',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('PaymentFile', ['read:own', 'read:all'], { of: 'Payment', id: 'payment_hash' })
  async listByPayment(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('payment_hash', { type: () => String }) paymentHash: string
  ): Promise<PaymentFileOutputDTO[]> {
    const items = await this.paymentFiles.listByPayment(coopname, paymentHash);
    return items.map((d) => PaymentFileOutputDTO.fromDomain(d));
  }
}
