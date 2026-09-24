import { ConflictException, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { AccountType } from '~/application/account/enum/account-type.enum';
import {
  EXTENSION_APP_TERMINATE_EVENT,
  type ExtensionAppTerminatePayload,
} from '@coopenomics/extension-kit';
import type { AgreementRegistrationSpec } from '../dto/agreement-registration-spec.dto';
import type { ProgramRegistrationSpec } from '../dto/program-registration-spec.dto';
import type { IntakeFormRegistrationSpec } from '../dto/intake-form-registration-spec.dto';
import { normalizeIntakeSchema, type IntakeJsonSchema } from '../utils/intake-schema.utils';
import type { AgreementRegistrationPort } from '../ports/agreement-registration.port';

/**
 * Анкета в реестре: то, что объявило расширение, плюс схема, приведённая к
 * виду для формы и проверки ответов.
 */
export interface RegisteredIntakeForm extends IntakeFormRegistrationSpec {
  json_schema: IntakeJsonSchema;
}

/**
 * In-memory реестр оферт, программ и анкет вступления, наполняемый расширениями
 * через AgreementRegistrationPort в lifecycle initialize(config).
 *
 * Tear-down автоматический: подписан на EXTENSION_APP_TERMINATE_EVENT —
 * при остановке расширения удаляет все записи с extension_name = appName.
 *
 * Идемпотентность: повторный register от того же extension_name с тем же id/key
 * перезаписывает spec. Конфликт id/key между разными extension_name
 * приводит к ConflictException — это симптом неконсистентной конфигурации
 * и должен быть замечен на этапе runApp.
 */
@Injectable()
export class AgreementRegistryService implements AgreementRegistrationPort {
  private readonly agreementMap = new Map<string, AgreementRegistrationSpec>();
  private readonly programMap = new Map<string, ProgramRegistrationSpec>();
  private readonly intakeFormMap = new Map<string, RegisteredIntakeForm>();

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(AgreementRegistryService.name);
  }

  registerAgreement(spec: AgreementRegistrationSpec): void {
    const existing = this.agreementMap.get(spec.id);
    if (existing && existing.extension_name !== spec.extension_name) {
      throw new ConflictException(
        // i18n-ignore: конфликт регистрации id соглашения между расширениями — ошибка конфигурации, до пайщика не доходит
        `Agreement id "${spec.id}" уже зарегистрирована расширением "${existing.extension_name}", ` +
          // i18n-ignore: продолжение сообщения о конфликте регистрации соглашения, до пайщика не доходит
          `повторная регистрация из "${spec.extension_name}" отклонена`
      );
    }
    this.agreementMap.set(spec.id, spec);
    this.logger.debug(
      `[REGISTRY] register agreement ${spec.id} (${spec.agreement_type}) от ${spec.extension_name}`
    );
  }

  unregisterAgreement(id: string, extension_name: string): void {
    const existing = this.agreementMap.get(id);
    if (!existing) return;
    if (existing.extension_name !== extension_name) {
      this.logger.warn(
        `[REGISTRY] попытка ${extension_name} снять чужую регистрацию ${id} (владелец ${existing.extension_name}) проигнорирована`
      );
      return;
    }
    this.agreementMap.delete(id);
    this.logger.debug(`[REGISTRY] unregister agreement ${id} от ${extension_name}`);
  }

  registerProgram(spec: ProgramRegistrationSpec): void {
    const existing = this.programMap.get(spec.key);
    if (existing && existing.extension_name !== spec.extension_name) {
      throw new ConflictException(
        // i18n-ignore: конфликт регистрации program key между расширениями — ошибка конфигурации, до пайщика не доходит
        `Program key "${spec.key}" уже зарегистрирована расширением "${existing.extension_name}", ` +
          // i18n-ignore: продолжение сообщения о конфликте регистрации program key, до пайщика не доходит
          `повторная регистрация из "${spec.extension_name}" отклонена`
      );
    }
    this.programMap.set(spec.key, spec);
    this.logger.debug(`[REGISTRY] register program ${spec.key} от ${spec.extension_name}`);
  }

  unregisterProgram(key: string, extension_name: string): void {
    const existing = this.programMap.get(key);
    if (!existing) return;
    if (existing.extension_name !== extension_name) {
      this.logger.warn(
        `[REGISTRY] попытка ${extension_name} снять чужую регистрацию программы ${key} (владелец ${existing.extension_name}) проигнорирована`
      );
      return;
    }
    this.programMap.delete(key);
    this.logger.debug(`[REGISTRY] unregister program ${key} от ${extension_name}`);
  }

  /**
   * Анкета вступления. Схема проверяется и приводится к рабочему виду сразу при
   * регистрации: до перерегистрации она не меняется, а кривая анкета должна
   * упасть на старте расширения, а не у вступающего.
   */
  registerIntakeForm(spec: IntakeFormRegistrationSpec): void {
    const existing = this.intakeFormMap.get(spec.id);
    if (existing && existing.extension_name !== spec.extension_name) {
      throw new ConflictException(
        // i18n-ignore: конфликт регистрации id анкеты между расширениями — ошибка конфигурации, до пайщика не доходит
        `Intake form id "${spec.id}" уже зарегистрирована расширением "${existing.extension_name}", ` +
          // i18n-ignore: продолжение сообщения о конфликте регистрации анкеты, до пайщика не доходит
          `повторная регистрация из "${spec.extension_name}" отклонена`
      );
    }
    this.intakeFormMap.set(spec.id, { ...spec, json_schema: normalizeIntakeSchema(spec.id, spec.schema) });
    this.logger.debug(`[REGISTRY] register intake form ${spec.id} от ${spec.extension_name}`);
  }

  unregisterIntakeForm(id: string, extension_name: string): void {
    const existing = this.intakeFormMap.get(id);
    if (!existing) return;
    if (existing.extension_name !== extension_name) {
      this.logger.warn(
        `[REGISTRY] попытка ${extension_name} снять чужую анкету ${id} (владелец ${existing.extension_name}) проигнорирована`
      );
      return;
    }
    this.intakeFormMap.delete(id);
    this.logger.debug(`[REGISTRY] unregister intake form ${id} от ${extension_name}`);
  }

  /**
   * Реестр чистит свои записи при остановке расширения.
   * Слушатель — обязательный hook tear-down порта (раздел 4.2 req 44).
   */
  @OnEvent(EXTENSION_APP_TERMINATE_EVENT)
  onExtensionTerminate(payload: ExtensionAppTerminatePayload): void {
    const removedAgreements: string[] = [];
    for (const [id, spec] of this.agreementMap.entries()) {
      if (spec.extension_name === payload.appName) {
        this.agreementMap.delete(id);
        removedAgreements.push(id);
      }
    }
    const removedPrograms: string[] = [];
    for (const [key, spec] of this.programMap.entries()) {
      if (spec.extension_name === payload.appName) {
        this.programMap.delete(key);
        removedPrograms.push(key);
      }
    }
    const removedIntakeForms: string[] = [];
    for (const [id, spec] of this.intakeFormMap.entries()) {
      if (spec.extension_name === payload.appName) {
        this.intakeFormMap.delete(id);
        removedIntakeForms.push(id);
      }
    }
    if (removedAgreements.length || removedPrograms.length || removedIntakeForms.length) {
      this.logger.info(
        `[REGISTRY] terminate ${payload.appName}: снято ${removedAgreements.length} оферт, ${removedPrograms.length} программ, ${removedIntakeForms.length} анкет`
      );
    }
  }

  /**
   * Получить spec оферты по id, либо null если не зарегистрирована.
   */
  getAgreement(id: string): AgreementRegistrationSpec | null {
    return this.agreementMap.get(id) ?? null;
  }

  /**
   * Получить spec программы по key, либо null.
   */
  getProgram(key: string): ProgramRegistrationSpec | null {
    return this.programMap.get(key) ?? null;
  }

  /**
   * Все зарегистрированные оферты, отсортированные по order.
   */
  listAgreements(): AgreementRegistrationSpec[] {
    return Array.from(this.agreementMap.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Все зарегистрированные программы, отсортированные по order.
   */
  listPrograms(): ProgramRegistrationSpec[] {
    return Array.from(this.programMap.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Оферты, применимые к типу аккаунта (фильтр по applicable_account_types).
   * Если applicable_account_types пуст — оферта НЕ выпадает «общим списком»
   * (исторический контракт GENERATOR_OFFER: подключается через программу).
   */
  listAgreementsForAccountType(accountType: AccountType): AgreementRegistrationSpec[] {
    return this.listAgreements().filter((spec) =>
      spec.applicable_account_types.includes(accountType)
    );
  }

  /**
   * Программы, применимые к типу аккаунта.
   */
  listProgramsForAccountType(accountType: AccountType): ProgramRegistrationSpec[] {
    return this.listPrograms().filter((spec) =>
      spec.applicable_account_types.includes(accountType)
    );
  }

  /**
   * Все оферты, привязанные к программе по её agreement_ids.
   * Возвращает оферты в порядке указания в program.agreement_ids,
   * пропуская незарегистрированные (защита от рассинхрона).
   */
  listAgreementsForProgram(programKey: string): AgreementRegistrationSpec[] {
    const program = this.getProgram(programKey);
    if (!program) return [];
    return program.agreement_ids
      .map((id) => this.getAgreement(id))
      .filter((spec): spec is AgreementRegistrationSpec => spec !== null);
  }

  getIntakeForm(id: string): RegisteredIntakeForm | null {
    return this.intakeFormMap.get(id) ?? null;
  }

  /** Все анкеты, отсортированные по order. */
  listIntakeForms(): RegisteredIntakeForm[] {
    return Array.from(this.intakeFormMap.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Анкеты, которые заполняет любой заявитель этого типа аккаунта. Анкета с
   * пустым applicable_account_types сюда не попадает — она идёт через программу.
   */
  listIntakeFormsForAccountType(accountType: AccountType): RegisteredIntakeForm[] {
    return this.listIntakeForms().filter((spec) => spec.applicable_account_types.includes(accountType));
  }

  /**
   * Анкеты программы в порядке её intake_form_ids; незарегистрированные
   * пропускаются (защита от рассинхрона).
   */
  listIntakeFormsForProgram(programKey: string): RegisteredIntakeForm[] {
    const program = this.getProgram(programKey);
    if (!program) return [];
    return (program.intake_form_ids ?? [])
      .map((id) => this.getIntakeForm(id))
      .filter((spec): spec is RegisteredIntakeForm => spec !== null);
  }
}

/** DI-токен для AgreementRegistryService при использовании через @Inject(). */
export const AGREEMENT_REGISTRY_SERVICE = Symbol('AgreementRegistryService');
