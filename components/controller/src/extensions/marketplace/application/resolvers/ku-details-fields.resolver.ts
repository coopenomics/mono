import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { KuDetailsDTO } from '../dto/ku-details.dto';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';

/**
 * Системный резолв реквизитов ПВЗ (`name`/`addressFull`/`contactPhone`/
 * `contactEmail`) живьём из организации кооперативного участка — единого
 * источника правды, который правит председатель в «Кооперативные участки».
 * Детализация ПВЗ их не хранит, поэтому рассинхрона между столами нет: оба
 * читают актуальные данные участка. Координаты/режим работы/статус приходят
 * сохранёнными полями самой `MarketplaceKUDetails`.
 */
@Resolver(() => KuDetailsDTO)
@Injectable()
export class MarketplaceKUDetailsFieldsResolver {
  constructor(private readonly displayService: MarketplaceOrderDisplayService) {}

  /**
   * Один резолв контактов участка на инстанс за запрос: промис кешируется прямо
   * на объекте, чтобы 4 поля не дёргали организацию повторно.
   */
  private contacts(
    ku: KuDetailsDTO
  ): Promise<{ name: string | null; address: string | null; phone: string | null; email: string | null }> {
    const memo = ku as KuDetailsDTO & {
      __contacts?: ReturnType<MarketplaceOrderDisplayService['resolveBranchContacts']>;
    };
    if (!memo.__contacts) memo.__contacts = this.displayService.resolveBranchContacts(ku.coreBraname);
    return memo.__contacts;
  }

  @ResolveField('name', () => String, {
    nullable: true,
    description: 'Наименование кооперативного участка (живьём из организации участка).',
  })
  async name(@Parent() ku: KuDetailsDTO): Promise<string | null> {
    return (await this.contacts(ku)).name;
  }

  @ResolveField('addressFull', () => String, {
    nullable: true,
    description: 'Адрес участка (живьём из организации участка).',
  })
  async addressFull(@Parent() ku: KuDetailsDTO): Promise<string | null> {
    return (await this.contacts(ku)).address;
  }

  @ResolveField('contactPhone', () => String, {
    nullable: true,
    description: 'Контактный телефон участка (живьём из организации участка).',
  })
  async contactPhone(@Parent() ku: KuDetailsDTO): Promise<string | null> {
    return (await this.contacts(ku)).phone;
  }

  @ResolveField('contactEmail', () => String, {
    nullable: true,
    description: 'Контактный email участка (живьём из организации участка).',
  })
  async contactEmail(@Parent() ku: KuDetailsDTO): Promise<string | null> {
    return (await this.contacts(ku)).email;
  }
}
