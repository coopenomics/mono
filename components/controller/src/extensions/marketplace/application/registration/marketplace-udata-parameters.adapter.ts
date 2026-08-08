import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import moment from 'moment';
import { randomBytes } from 'crypto';

import { UDATA_REPOSITORY, UdataRepository } from '~/domain/common/repositories/udata.repository';
import type { MarketplaceUdataParametersPort } from '~/domain/common/ports/marketplace-udata-parameters.port';

/**
 * Реализация `MarketplaceUdataParametersPort` для расширения marketplace.
 *
 * Генерирует и персистит уникальный номер и дату оферты ЦПП «Стол заказов» для
 * пары (coopname, username) в Udata. Эти значения читает фабрика инстанса оферты
 * (registry 1102.MarketplaceOffer) при рендере персонального документа пайщика —
 * паттерн идентичен capital (оферта Генератора, registry 996).
 *
 * Идемпотентность: если номер уже выдан — повторно не генерируем, иначе хэш
 * повторного рендера разойдётся с тем, что подписал пайщик.
 */
@Injectable()
export class MarketplaceUdataParametersAdapter implements MarketplaceUdataParametersPort {
  private readonly logger = new Logger(MarketplaceUdataParametersAdapter.name);

  constructor(@Inject(UDATA_REPOSITORY) private readonly udataRepository: UdataRepository) {}

  private generateDocumentNumber(): string {
    return randomBytes(32).toString('hex').substring(0, 16).toUpperCase();
  }

  async generateMarketplaceOfferParameters(coopname: string, username: string): Promise<void> {
    const existingNumber = await this.udataRepository.get(
      coopname,
      username,
      Cooperative.Model.UdataKey.MARKETPLACE_AGREEMENT_NUMBER
    );

    if (existingNumber?.value) {
      this.logger.log(
        `Параметры оферты «Стол заказов» уже существуют для ${username}: ${existingNumber.value}`
      );
      return;
    }

    const number = this.generateDocumentNumber();
    const date = moment().format('DD.MM.YYYY');

    await Promise.all([
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.MARKETPLACE_AGREEMENT_NUMBER,
        value: number,
      }),
      this.udataRepository.save({
        coopname,
        username,
        key: Cooperative.Model.UdataKey.MARKETPLACE_AGREEMENT_CREATED_AT,
        value: date,
      }),
    ]);

    this.logger.log(`Созданы параметры оферты «Стол заказов» для ${username}: ${number}, ${date}`);
  }
}
