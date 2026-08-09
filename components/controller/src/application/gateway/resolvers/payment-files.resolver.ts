import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
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
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async uploadPaymentProof(
    @Args('data', { type: () => UploadPaymentProofInputDTO }) data: UploadPaymentProofInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<PaymentFileOutputDTO> {
    const { data: saved, readUrl } = await this.paymentFiles.uploadProof(data, user.username);
    return PaymentFileOutputDTO.fromDomain(saved, readUrl);
  }

  @Query(() => PaymentFileOutputDTO, {
    name: 'paymentFile',
    description: 'Получить запись о файле платежа + свежий короткоживущий read-URL.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getPaymentFile(@Args('id', { type: () => Int }) id: number): Promise<PaymentFileOutputDTO> {
    const { data, readUrl } = await this.paymentFiles.getReadUrl(id);
    return PaymentFileOutputDTO.fromDomain(data, readUrl);
  }

  @Query(() => [PaymentFileOutputDTO], {
    name: 'paymentProofs',
    description: 'Список чеков об оплате платежа (без read-URL — запрос отдельно по id).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async listByPayment(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('payment_hash', { type: () => String }) paymentHash: string
  ): Promise<PaymentFileOutputDTO[]> {
    const items = await this.paymentFiles.listByPayment(coopname, paymentHash);
    return items.map((d) => PaymentFileOutputDTO.fromDomain(d));
  }
}
