import { Global, Module } from '@nestjs/common';
import { AgreementConfigurationService, AGREEMENT_CONFIGURATION_SERVICE } from './services/agreement-configuration.service';
import { AgreementRegistryService, AGREEMENT_REGISTRY_SERVICE } from './services/agreement-registry.service';
import { RegistrationDocumentsService, REGISTRATION_DOCUMENTS_SERVICE } from './services/registration-documents.service';
import { CooperativeConfigService } from './services/cooperative-config.service';
import { AGREEMENT_REGISTRATION_PORT } from './ports/agreement-registration.port';
import { AGREEMENT_QUERY_PORT } from './ports/agreement-query.port';
import { DocumentModule } from '~/application/document/document.module';
import { RegistrationDocumentParametersRegistry } from './services/registration-document-parameters.registry';
import { ExtensionOfferFilterRegistry } from './services/extension-offer-filter.registry';

/**
 * Глобальный модуль для сервисов регистрации
 * Сделан глобальным чтобы быть доступным в BlockchainModule (который тоже глобальный)
 *
 * Модуль расширений здесь не импортируется, и это принципиально: и состав
 * оферт, и параметры к ним расширение кладёт в реестры само при запуске —
 * `AgreementRegistryService` и `RegistrationDocumentParametersRegistry`. Оба
 * реестра — тот же приём, что у прав рабочего стола (`ExtensionGrantsRegistry`).
 * Инъекция по токену хука здесь не подошла бы: видимость провайдера в Nest
 * даёт только импорт модуля, то есть ядро тянуло бы к себе модуль расширений
 * и получало цикл.
 */
@Global()
@Module({
  imports: [
    DocumentModule,
  ],
  providers: [
    CooperativeConfigService,
    ExtensionOfferFilterRegistry,
    AgreementConfigurationService,
    {
      provide: AGREEMENT_CONFIGURATION_SERVICE,
      useExisting: AgreementConfigurationService,
    },
    AgreementRegistryService,
    {
      provide: AGREEMENT_REGISTRY_SERVICE,
      useExisting: AgreementRegistryService,
    },
    {
      provide: AGREEMENT_REGISTRATION_PORT,
      useExisting: AgreementRegistryService,
    },
    {
      provide: AGREEMENT_QUERY_PORT,
      useExisting: AgreementConfigurationService,
    },
    RegistrationDocumentParametersRegistry,
    RegistrationDocumentsService,
    {
      provide: REGISTRATION_DOCUMENTS_SERVICE,
      useExisting: RegistrationDocumentsService,
    },
  ],
  exports: [
    RegistrationDocumentParametersRegistry,
    ExtensionOfferFilterRegistry,
    AgreementConfigurationService,
    AGREEMENT_CONFIGURATION_SERVICE,
    AgreementRegistryService,
    AGREEMENT_REGISTRY_SERVICE,
    AGREEMENT_REGISTRATION_PORT,
    AGREEMENT_QUERY_PORT,
    RegistrationDocumentsService,
    REGISTRATION_DOCUMENTS_SERVICE,
  ],
})
export class RegistrationDomainModule {}
