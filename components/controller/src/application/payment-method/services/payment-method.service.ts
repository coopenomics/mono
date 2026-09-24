// payment-method.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentMethodInteractor } from '../interactors/payment-method.interactor';
import type { GetPaymentMethodsInputDTO } from '../dto/get-payment-methods-input.dto';
import type { UpdateBankAccountInputDTO } from '../dto/update-bank-account-input.dto';
import type { DeletePaymentMethodDTO } from '../dto/delete-payment-method-input.dto';
import type { CreateBankAccountInputDTO } from '../dto/create-bank-account-input.dto';
import type { AddPaymentMethodInputDTO } from '../dto/add-payment-method-input.dto';
import type { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { PaymentMethodDTO } from '../dto/payment-method.dto';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class PaymentMethodService {
  constructor(private readonly paymentMethodInteractor: PaymentMethodInteractor) {}

  async listPaymentMethods(
    data?: GetPaymentMethodsInputDTO
  ): Promise<PaginationResultDomainInterface<PaymentMethodDomainEntity>> {
    return this.paymentMethodInteractor.listPaymentMethods(data);
  }

  async createBankAccount(data: CreateBankAccountInputDTO): Promise<PaymentMethodDTO> {
    return new PaymentMethodDTO(await this.paymentMethodInteractor.createBankAccount(data));
  }

  async addPaymentMethod(data: AddPaymentMethodInputDTO): Promise<PaymentMethodDTO> {
    let methodType: 'bank_transfer' | 'sbp';
    let methodData: any;

    if (data.bank_transfer_data) {
      methodType = 'bank_transfer';
      methodData = data.bank_transfer_data;
    } else if (data.sbp_data) {
      methodType = 'sbp';
      methodData = data.sbp_data;
    } else {
      throw DomainError.internal('PAYMENT_METHOD_TYPE_REQUIRED');
    }

    const domainData = {
      username: data.username,
      is_default: data.is_default,
      method_type: methodType,
      data: methodData,
    };

    return new PaymentMethodDTO(await this.paymentMethodInteractor.addPaymentMethod(domainData));
  }

  async updateBankAccount(data: UpdateBankAccountInputDTO): Promise<PaymentMethodDTO> {
    return new PaymentMethodDTO(await this.paymentMethodInteractor.updateBankAccount(data));
  }

  async deletePaymentMethod(data: DeletePaymentMethodDTO): Promise<void> {
    await this.paymentMethodInteractor.deletePaymentMethod(data.username, data.method_id);
  }
}

// ПАГИНАЦИЯ на будущее как-то так. Работа должна быть реализована в репозиториях
// /**
//    * Получает список методов оплаты с учётом пагинации и сортировки.
//    *
//    * @param paginationInput - Параметры пагинации и сортировки.
//    * @returns {Promise<PaginationResult<PaymentMethodEntity>>}
//    */
// async listPaymentMethods(
//   paginationInput: PaginationInputDTO
// ): Promise<PaginationResult<PaymentMethodEntity>> {
//   const queryBuilder = this.paymentMethodRepository.createQueryBuilder('paymentMethod');
//   return this.paginationService.paginate(queryBuilder, paginationInput);
// }
