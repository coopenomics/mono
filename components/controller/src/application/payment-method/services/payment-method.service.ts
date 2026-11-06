// payment-method.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentMethodInteractor } from '../interactors/payment-method.interactor';
import type { GetPaymentMethodsInputDTO } from '../dto/get-payment-methods-input.dto';
import type { UpdateBankAccountInputDTO } from '../dto/update-bank-account-input.dto';
import type { DeletePaymentMethodDTO } from '../dto/delete-payment-method-input.dto';
import type { CreateBankAccountInputDTO } from '../dto/create-bank-account-input.dto';
import type { AddPaymentMethodInputDTO } from '../dto/add-payment-method-input.dto';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { PaymentMethodDTO } from '../dto/payment-method.dto';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class PaymentMethodService {
  constructor(private readonly paymentMethodInteractor: PaymentMethodInteractor) {}

  /**
   * Список проходит через DTO, как и одиночный ответ: у реквизитов СБП,
   * сохранённых до появления поля банка, DTO подставляет пустую строку.
   * Доменная запись без DTO отдавала в обязательное поле `SbpAccount.bank_name`
   * пустоту, и запрос реквизитов на столе падал целиком (задача 367-3).
   */
  async listPaymentMethods(
    data?: GetPaymentMethodsInputDTO
  ): Promise<PaginationResultDomainInterface<PaymentMethodDTO>> {
    const page = await this.paymentMethodInteractor.listPaymentMethods(data);
    return { ...page, items: page.items.map((item) => new PaymentMethodDTO(item)) };
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
      throw DomainError.badRequest('PAYMENT_METHOD_TYPE_REQUIRED');
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
