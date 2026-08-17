import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { UdataDocumentParametersService, UDATA_DOCUMENT_PARAMETERS_SERVICE } from '../../domain/services/udata-document-parameters.service';
import {
  type IProgramDocumentParametersHook,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  type IRegistrationDocumentParametersRegistryPort,
} from '@coopenomics/innercoop';

/**
 * Адаптер для реализации порта IProgramDocumentParametersHook в Capital расширении
 *
 * Сам себя кладёт в реестр ядра при запуске, поэтому поток вступления не
 * импортирует модуль расширений (нет цикла зависимостей) — тот же приём, что у
 * прав рабочего стола.
 */
@Injectable()
export class UdataDocumentParametersAdapter implements IProgramDocumentParametersHook, OnModuleInit {
  constructor(
    @Inject(UDATA_DOCUMENT_PARAMETERS_SERVICE)
    private readonly udataDocumentParametersService: UdataDocumentParametersService,
    @Inject(REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT)
    private readonly parametersRegistry: IRegistrationDocumentParametersRegistryPort
  ) {}

  onModuleInit(): void {
    this.parametersRegistry.registerProgramHook(this);
  }

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
