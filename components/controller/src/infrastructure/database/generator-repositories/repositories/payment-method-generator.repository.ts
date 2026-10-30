// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { Cooperative } from 'cooptypes';
import type { IPaymentData } from '@coopenomics/docs-templates';
import type { PaymentMethodRepository } from '~/domain/common/repositories/payment-method.repository';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type { ListPaymentMethodsDomainInterface } from '~/domain/payment-method/interfaces/list-payment-methods-input.interface';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { GetPaymentMethodDomainInterface } from '~/domain/payment-method/interfaces/get-payment-method-domain.interface';

@Injectable()
export class PaymentMethodRepositoryImplementation implements PaymentMethodRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async save(data: PaymentMethodDomainEntity): Promise<PaymentMethodDomainEntity> {
    await this.generatorPort.save('paymentMethod', data as any);
    return data;
  }
  async delete(username: string, method_id: string): Promise<void> {
    await this.generatorPort.del('paymentMethod', { username, method_id });
  }

  async get(data: GetPaymentMethodDomainInterface): Promise<PaymentMethodDomainEntity> {
    const result = (await this.generatorPort.get('paymentMethod', data)) as IPaymentData;
    return new PaymentMethodDomainEntity(result);
  }

  async list(data?: ListPaymentMethodsDomainInterface): Promise<PaginationResultDomainInterface<PaymentMethodDomainEntity>> {
    const filter = data ? (data.username ? { username: data.username } : {}) : {};

    //TODO пагинация здесь не работает. Заработает после выделения генератора в отдельный сервис.
    const result = (await this.generatorPort.list(
      'paymentMethod',
      filter
    )) as Cooperative.Document.IGetResponse<IPaymentData>;

    const result2: PaginationResultDomainInterface<PaymentMethodDomainEntity> = {
      items: result.results.map((method) => new PaymentMethodDomainEntity(method)),
      totalCount: result.totalResults,
      totalPages: result.totalPages,
      currentPage: result.page,
    };

    return result2;
  }
}
