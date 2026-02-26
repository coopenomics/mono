import { Injectable, Inject } from '@nestjs/common';
import { UdataDocumentParametersPort } from '~/domain/common/ports/udata-document-parameters.port';
import { UdataDocumentParametersService, UDATA_DOCUMENT_PARAMETERS_SERVICE } from '../../domain/services/udata-document-parameters.service';

/**
 * Адаптер для реализации порта UdataDocumentParametersPort в Capital расширении
 */
@Injectable()
export class UdataDocumentParametersAdapter implements UdataDocumentParametersPort {
  constructor(
    @Inject(UDATA_DOCUMENT_PARAMETERS_SERVICE)
    private readonly udataDocumentParametersService: UdataDocumentParametersService
  ) {}

  /**
   * Генерирует и сохраняет параметры для оферты Благорост
   */
  async generateBlagorostOfferParameters(coopname: string, username: string): Promise<void> {
    return this.udataDocumentParametersService.generateBlagorostOfferParameters(coopname, username);
  }

  /**
   * Генерирует и сохраняет параметры для оферты Генератор
   */
  async generateGeneratorOfferParameters(coopname: string, username: string): Promise<void> {
    return this.udataDocumentParametersService.generateGeneratorOfferParameters(coopname, username);
  }

  /**
   * Генерирует и сохраняет параметры для договора УХД (Generation Contract)
   */
  async generateGenerationContractParameters(coopname: string, username: string): Promise<void> {
    return this.udataDocumentParametersService.generateGenerationContractParameters(coopname, username);
  }

  /**
   * Генерирует и сохраняет параметры для соглашения о хранении
   */
  async generateStorageAgreementParameters(coopname: string, username: string): Promise<void> {
    return this.udataDocumentParametersService.generateStorageAgreementParameters(coopname, username);
  }

  /**
   * Генерирует и сохраняет параметры для соглашения Благорост (если еще не существуют)
   * Используется для пути Генератора
   */
  async generateBlagorostAgreementParametersIfNotExist(coopname: string, username: string): Promise<void> {
    return this.udataDocumentParametersService.generateBlagorostAgreementParametersIfNotExist(coopname, username);
  }
}
