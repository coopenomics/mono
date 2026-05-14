import { Inject, Injectable } from '@nestjs/common';
import { REGISTRATION_AGREEMENTS_CONFIG } from '../config/registration-agreements.config';
import type {
  IAgreementConfigItem,
  IRegistrationProgram,
} from '../config/agreement-config.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { AgreementRegistryService, AGREEMENT_REGISTRY_SERVICE } from './agreement-registry.service';
import type { AgreementRegistrationSpec } from '../dto/agreement-registration-spec.dto';
import type { ProgramRegistrationSpec } from '../dto/program-registration-spec.dto';
import { CooperativeConfigService } from './cooperative-config.service';

export const AGREEMENT_CONFIGURATION_SERVICE = Symbol('AgreementConfigurationService');

/**
 * Сервис для работы с конфигурацией соглашений при регистрации.
 *
 * После Эпика 1.3 раздел C28-10 источник правды двухуровневый:
 *   1) платформенные оферты (signature/wallet/user/privacy) —
 *      из REGISTRATION_AGREEMENTS_CONFIG;
 *   2) extension-оферты и программы — из AgreementRegistryService,
 *      наполняемого расширениями через AgreementRegistrationPort
 *      на этапе initialize(config).
 *
 * Этот сервис сливает оба источника в форму IAgreementConfigItem /
 * IRegistrationProgram, которую ожидают вышестоящие consumers
 * (Resolver, SignUp, participant.interactor).
 */
@Injectable()
export class AgreementConfigurationService {
  constructor(
    private readonly cooperativeConfigService: CooperativeConfigService,
    @Inject(AGREEMENT_REGISTRY_SERVICE)
    private readonly agreementRegistry: AgreementRegistryService
  ) {}

  /**
   * Адаптер spec → config item. Поля is_blockchain_agreement / link_to_statement
   * для extension-оферт всегда true по контракту (план C28-10 раздел 1.1).
   */
  private specToConfigItem(spec: AgreementRegistrationSpec): IAgreementConfigItem {
    return {
      id: spec.id,
      registry_id: spec.registry_id,
      agreement_type: spec.agreement_type,
      title: spec.title,
      checkbox_text: spec.checkbox_text,
      link_text: spec.link_text,
      is_blockchain_agreement: true,
      link_to_statement: true,
      applicable_account_types: spec.applicable_account_types,
      order: spec.order,
    };
  }

  private programSpecToConfig(spec: ProgramRegistrationSpec): IRegistrationProgram {
    return {
      key: spec.key,
      title: spec.title,
      description: spec.description,
      image_url: spec.image_url,
      requirements: spec.requirements,
      applicable_account_types: spec.applicable_account_types,
      agreement_ids: spec.agreement_ids,
      order: spec.order,
    };
  }

  /**
   * Соглашения по умолчанию для кооператива: платформенные базовые +
   * extension-оферты, применимые к типу аккаунта (без программы).
   */
  private getDefaultAgreementsForCooperative(
    accountType: AccountType,
    coopname?: string
  ): IAgreementConfigItem[] {
    const coopnameValue = coopname || '';

    const baseAgreements = REGISTRATION_AGREEMENTS_CONFIG.agreements.filter((a) =>
      a.applicable_account_types.includes(accountType)
    );

    const extensionAgreements = this.agreementRegistry
      .listAgreementsForAccountType(accountType)
      .map((spec) => this.specToConfigItem(spec));

    const additionalAgreements = this.cooperativeConfigService
      .getDefaultAdditionalAgreements(coopnameValue, accountType)
      .map((id) => this.getAgreementById(id))
      .filter((a): a is IAgreementConfigItem => a !== null);

    return [...baseAgreements, ...extensionAgreements, ...additionalAgreements].sort(
      (a, b) => a.order - b.order
    );
  }

  getAgreementsForAccountType(
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): IAgreementConfigItem[] {
    const defaultAgreements = this.getDefaultAgreementsForCooperative(accountType, coopname);

    if (programKey) {
      const programAgreements = this.getAgreementsForProgram(programKey);
      return [...defaultAgreements, ...programAgreements].sort((a, b) => a.order - b.order);
    }

    return defaultAgreements;
  }

  /**
   * Соглашения, которые нужно отправить в блокчейн через sendAgreement
   */
  getBlockchainAgreements(
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): IAgreementConfigItem[] {
    return this.getAgreementsForAccountType(accountType, coopname, programKey).filter(
      (agreement) => agreement.is_blockchain_agreement
    );
  }

  /**
   * Соглашения, которые нужно линковать в заявление на вступление
   */
  getLinkedAgreements(
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): IAgreementConfigItem[] {
    return this.getAgreementsForAccountType(accountType, coopname, programKey).filter(
      (agreement) => agreement.link_to_statement
    );
  }

  /**
   * Конфигурация соглашения по идентификатору (платформенный или
   * extension-зарегистрированный).
   */
  getAgreementById(id: string): IAgreementConfigItem | null {
    const baseMatch = REGISTRATION_AGREEMENTS_CONFIG.agreements.find(
      (agreement) => agreement.id === id
    );
    if (baseMatch) return baseMatch;

    const spec = this.agreementRegistry.getAgreement(id);
    return spec ? this.specToConfigItem(spec) : null;
  }

  /**
   * Все доступные соглашения (без фильтрации по типу аккаунта).
   */
  getAllAgreements(): IAgreementConfigItem[] {
    const base = REGISTRATION_AGREEMENTS_CONFIG.agreements;
    const ext = this.agreementRegistry.listAgreements().map((spec) => this.specToConfigItem(spec));
    return [...base, ...ext].sort((a, b) => a.order - b.order);
  }

  isAgreementRequired(
    agreementId: string,
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): boolean {
    const requiredAgreements = this.getRequiredAgreementIds(accountType, coopname, programKey);
    return requiredAgreements.includes(agreementId);
  }

  getRequiredAgreementIds(
    accountType: AccountType,
    coopname?: string,
    programKey?: string
  ): string[] {
    return this.getAgreementsForAccountType(accountType, coopname, programKey).map((a) => a.id);
  }

  /**
   * Доступные программы регистрации для кооператива и типа аккаунта.
   * coopname в текущей модели не используется (registry даёт программы
   * одной инсталляции), но сохранён в сигнатуре ради совместимости
   * с GraphQL-резолвером и для будущего coop-scoping.
   */
  getAvailablePrograms(_coopname: string, accountType: AccountType): IRegistrationProgram[] {
    return this.agreementRegistry
      .listProgramsForAccountType(accountType)
      .map((spec) => this.programSpecToConfig(spec));
  }

  /**
   * Соглашения, привязанные к программе через её agreement_ids.
   */
  getAgreementsForProgram(programKey: string): IAgreementConfigItem[] {
    return this.agreementRegistry
      .listAgreementsForProgram(programKey)
      .map((spec) => this.specToConfigItem(spec));
  }
}
