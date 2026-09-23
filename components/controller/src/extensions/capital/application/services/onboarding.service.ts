import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuid } from 'uuid';
import { EXTENSION_REPOSITORY, ExtensionDomainRepository, platformSettings, DomainError } from '@coopenomics/extension-kit';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { CapitalOnboardingStepInputDTO, CapitalOnboardingStepEnum, CapitalOnboardingStateDTO } from '../dto/onboarding.dto';
import type { IConfig } from '../../capital-extension.module';
import { Cooperative } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { IDecisionTrackingPort, DECISION_TRACKING_PORT, DecisionEventType } from '@coopenomics/innercoop';
import { IFreeDecisionPort, FREE_DECISION_PORT } from '@coopenomics/innercoop';
import { IDocumentApprovalPort, DOCUMENT_APPROVAL_PORT } from '@coopenomics/innercoop';
import { LOGGER_PORT, type ILoggerPort, ONBOARDING_COMPLETED_EVENT } from '@coopenomics/innercoop';
import { computeOnboardingExpiresAt } from '@coopenomics/extension-kit';

type OnboardingFlagKey =
  | 'onboarding_generator_program_template_done'
  | 'onboarding_generation_contract_template_done'
  | 'onboarding_generator_offer_template_done'
  | 'onboarding_blagorost_provision_done'
  | 'onboarding_blagorost_offer_template_done';

type OnboardingHashKey =
  | 'onboarding_generator_program_template_hash'
  | 'onboarding_generation_contract_template_hash'
  | 'onboarding_generator_offer_template_hash'
  | 'onboarding_blagorost_provision_hash'
  | 'onboarding_blagorost_offer_template_hash';

type CapitalOnboardingConfig = IConfig &
  Partial<Record<OnboardingFlagKey, boolean>> &
  Partial<Record<OnboardingHashKey | 'onboarding_init_at' | 'onboarding_expire_at' | 'capital_program_doc_data_hash', string>>;

@Injectable()
export class CapitalOnboardingService {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(FREE_DECISION_PORT) private readonly freeDecisionPort: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT) private readonly decisionTrackingPort: IDecisionTrackingPort,
    @Inject(DOCUMENT_APPROVAL_PORT) private readonly documentApprovals: IDocumentApprovalPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly eventEmitter: EventEmitter2
  ) {}

  private mapStepToFlag(step: CapitalOnboardingStepEnum): OnboardingFlagKey {
    switch (step) {
      case CapitalOnboardingStepEnum.generator_program_template:
        return 'onboarding_generator_program_template_done';
      case CapitalOnboardingStepEnum.generation_contract_template:
        return 'onboarding_generation_contract_template_done';
      case CapitalOnboardingStepEnum.generator_offer_template:
        return 'onboarding_generator_offer_template_done';
      case CapitalOnboardingStepEnum.blagorost_program:
        return 'onboarding_blagorost_provision_done';
      case CapitalOnboardingStepEnum.blagorost_offer_template:
        return 'onboarding_blagorost_offer_template_done';
      default:
        throw DomainError.internal('CAPITAL_ONBOARDING_UNKNOWN_STEP', { step });
    }
  }

  private mapStepToHash(step: CapitalOnboardingStepEnum): OnboardingHashKey {
    switch (step) {
      case CapitalOnboardingStepEnum.generator_program_template:
        return 'onboarding_generator_program_template_hash';
      case CapitalOnboardingStepEnum.generation_contract_template:
        return 'onboarding_generation_contract_template_hash';
      case CapitalOnboardingStepEnum.generator_offer_template:
        return 'onboarding_generator_offer_template_hash';
      case CapitalOnboardingStepEnum.blagorost_program:
        return 'onboarding_blagorost_provision_hash';
      case CapitalOnboardingStepEnum.blagorost_offer_template:
        return 'onboarding_blagorost_offer_template_hash';
      default:
        throw DomainError.internal('CAPITAL_ONBOARDING_UNKNOWN_STEP', { step });
    }
  }

  private mapStepToVarsField(step: CapitalOnboardingStepEnum): string {
    switch (step) {
      case CapitalOnboardingStepEnum.generator_program_template:
        return 'generator_program';
      case CapitalOnboardingStepEnum.generation_contract_template:
        return 'generation_contract_template';
      case CapitalOnboardingStepEnum.generator_offer_template:
        return 'generator_offer_template';
      case CapitalOnboardingStepEnum.blagorost_program:
        return 'blagorost_program';
      case CapitalOnboardingStepEnum.blagorost_offer_template:
        return 'blagorost_offer_template';
      default:
        throw DomainError.internal('CAPITAL_ONBOARDING_UNKNOWN_STEP', { step });
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getMetaString(meta: unknown, key: string): string | undefined {
    if (!this.isRecord(meta)) return undefined;
    const value = meta[key];
    return typeof value === 'string' ? value : undefined;
  }

  private isSignatureInfo(value: unknown): value is ISignedDocument['signatures'][number] {
    if (!this.isRecord(value)) return false;

    return (
      typeof value.id === 'number' &&
      typeof value.signed_hash === 'string' &&
      typeof value.signer === 'string' &&
      typeof value.public_key === 'string' &&
      typeof value.signature === 'string' &&
      typeof value.signed_at === 'string' &&
      typeof value.meta === 'string'
    );
  }

  private getMetaSignatures(meta: unknown): ISignedDocument['signatures'] {
    if (!this.isRecord(meta)) return [];
    const value = meta.signatures;
    return Array.isArray(value) ? value.filter((item) => this.isSignatureInfo(item)) : [];
  }

  private async loadExtension(): Promise<ExtensionDomainEntity<CapitalOnboardingConfig>> {
    const extension = await this.extensionRepository.findByName('capital');
    if (!extension) throw DomainError.internal('CAPITAL_EXTENSION_CONFIG_NOT_FOUND');
    const extensionConfig: CapitalOnboardingConfig = { ...extension.config };

    const patch: Partial<CapitalOnboardingConfig> = {};
    if (!extensionConfig.onboarding_init_at) {
      extensionConfig.onboarding_init_at = new Date().toISOString();
      patch.onboarding_init_at = extensionConfig.onboarding_init_at;
    }

    if (!extensionConfig.onboarding_expire_at) {
      const start = new Date(extensionConfig.onboarding_init_at);
      extensionConfig.onboarding_expire_at = computeOnboardingExpiresAt(start);
      patch.onboarding_expire_at = extensionConfig.onboarding_expire_at;
    }

    if (Object.keys(patch).length > 0) {
      // Точечный merge только изменившихся полей — полная перезапись config
      // целиком (как раньше) конкурирует с параллельными записями других шагов
      // онбординга (флаги, хэши) и теряет их изменения (lost update).
      const updated = await this.extensionRepository.patchConfig('capital', patch);
      return { ...extension, config: updated.config };
    }

    return { ...extension, config: extensionConfig };
  }

  private buildState(extensionConfig: CapitalOnboardingConfig): CapitalOnboardingStateDTO {
    return {
      generator_program_template_done: !!extensionConfig.onboarding_generator_program_template_done,
      onboarding_generator_program_template_hash: extensionConfig.onboarding_generator_program_template_hash || null,
    generation_contract_template_done: !!extensionConfig.onboarding_generation_contract_template_done,
    onboarding_generation_contract_template_hash: extensionConfig.onboarding_generation_contract_template_hash || null,
    generator_offer_template_done: !!extensionConfig.onboarding_generator_offer_template_done,
    onboarding_generator_offer_template_hash: extensionConfig.onboarding_generator_offer_template_hash || null,
      blagorost_provision_done: !!extensionConfig.onboarding_blagorost_provision_done,
      onboarding_blagorost_provision_hash: extensionConfig.onboarding_blagorost_provision_hash || null,
      blagorost_offer_template_done: !!extensionConfig.onboarding_blagorost_offer_template_done,
      onboarding_blagorost_offer_template_hash: extensionConfig.onboarding_blagorost_offer_template_hash || null,
      capital_program_doc_data_hash: extensionConfig.capital_program_doc_data_hash || null,
      onboarding_init_at: extensionConfig.onboarding_init_at || '',
      onboarding_expire_at: extensionConfig.onboarding_expire_at || '',
    };
  }

  /**
   * Сводит отметки шагов с утверждениями в цепи и дописывает недостающие.
   *
   * Отметка в настройке расширения — то, по чему capital решает, завершено ли
   * подключение и пора ли предлагать свои программы вступающим. Ставит её
   * приёмник решения совета, но решение может пройти мимо него: документ
   * утвердили со вкладки «Шаблоны документов», пока контроллер не работал, или
   * приёмник не узнал ключ шага. Тогда карточка подключения показывает «всё
   * принято», а программ во вступлении нет. Источник правды — утверждение в
   * цепи, поэтому отметка дописывается здесь же, а не только рисуется.
   */
  public async reconcileFlags(): Promise<ExtensionDomainEntity<IConfig>['config']> {
    const extension = await this.loadExtension();
    const patch: Partial<Record<OnboardingFlagKey, boolean>> = {};

    for (const step of Object.values(CapitalOnboardingStepEnum)) {
      const flagKey = this.mapStepToFlag(step);
      if (extension.config[flagKey]) continue;
      if (await this.documentApprovals.isStepApproved('capital', this.mapStepToVarsField(step))) {
        patch[flagKey] = true;
      }
    }

    if (Object.keys(patch).length === 0) return extension.config;

    const updated = await this.extensionRepository.patchConfig('capital', patch as Partial<CapitalOnboardingConfig>);
    this.logger.warn(
      `[CAPITAL.ONBOARDING] отметки шагов дописаны по утверждениям в цепи: ${Object.keys(patch).join(', ')}`
    );

    // Дописана последняя отметка — подключение завершено; расширение
    // перезапустится и зарегистрирует свои программы во вступлении.
    const allDone = Object.values(CapitalOnboardingStepEnum).every((step) => Boolean(updated.config[this.mapStepToFlag(step)]));
    if (allDone) {
      this.eventEmitter.emit(ONBOARDING_COMPLETED_EVENT, { extension_name: 'capital' });
    }
    return updated.config;
  }

  public async getState(): Promise<CapitalOnboardingStateDTO> {
    return this.buildState((await this.reconcileFlags()) as CapitalOnboardingConfig);
  }

  public async saveProgramDocDataHash(docDataHash: string): Promise<CapitalOnboardingStateDTO> {
    await this.loadExtension();
    const normalizedHash = docDataHash.trim();

    if (!normalizedHash) {
      throw DomainError.internal('CAPITAL_PROGRAM_DOC_DATA_HASH_EMPTY');
    }

    const updated = await this.extensionRepository.patchConfig('capital', {
      capital_program_doc_data_hash: normalizedHash,
    } as Partial<CapitalOnboardingConfig>);

    return this.buildState(updated.config as CapitalOnboardingConfig);
  }

  /**
   * Шаги про документы ведёт фабрика утверждений: проект решения собирается
   * из текста шаблона в цепи, утверждение после решения фиксируется в цепи.
   * `null` — у шага нет документов, он идёт прежним путём.
   */
  private async completeViaFactory(
    step: CapitalOnboardingStepEnum,
    flagKey: OnboardingFlagKey,
    hashKey: OnboardingHashKey,
    username: string,
    title?: string,
    doc_data_hash?: string
  ): Promise<CapitalOnboardingStateDTO | null> {
    const viaFactory = await this.documentApprovals.proposeOnboardingStep({
      extension_name: 'capital',
      step_key: this.mapStepToVarsField(step),
      username,
      title,
      doc_data_hash,
    });
    if (!viaFactory) return null;
    const patch = (viaFactory.approved ? { [flagKey]: true } : { [hashKey]: viaFactory.hash ?? '' }) as Partial<CapitalOnboardingConfig>;
    const updated = await this.extensionRepository.patchConfig('capital', patch);
    return this.buildState(updated.config as CapitalOnboardingConfig);
  }

  public async completeStep(data: CapitalOnboardingStepInputDTO, username: string): Promise<CapitalOnboardingStateDTO> {
    const extension = await this.loadExtension();
    const flagKey = this.mapStepToFlag(data.step);
    const hashKey = this.mapStepToHash(data.step);
    const normalizedTitle = data.title?.trim().substring(0, 200) || undefined;

    if (extension.config[flagKey]) {
      return this.buildState(extension.config);
    }

    const viaFactory = await this.completeViaFactory(
      data.step,
      flagKey,
      hashKey,
      username,
      normalizedTitle,
      extension.config.capital_program_doc_data_hash || undefined
    );
    if (viaFactory) return viaFactory;

    const { project_id, hash: publishedHash, updated } = await this.publishLegacyStep(data, hashKey, username, normalizedTitle);

    // Регистрируем правило отслеживания в фабрике
    const varsField = this.mapStepToVarsField(data.step);

    await this.decisionTrackingPort.registerTrackingRule({
      hash: publishedHash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: varsField,
      metadata: {
        onboarding_step: data.step,
        project_id,
        extension: 'capital',
      },
    });

    return this.buildState(updated.config as CapitalOnboardingConfig);
  }

  /**
   * Прежний путь шага без документов: проект свободного решения с текстом из
   * карточки, публикация в повестку, хэш в настройке расширения.
   */
  private async publishLegacyStep(
    data: CapitalOnboardingStepInputDTO,
    hashKey: OnboardingHashKey,
    username: string,
    normalizedTitle?: string
  ): Promise<{ project_id: string; hash: string; updated: ExtensionDomainEntity<CapitalOnboardingConfig> }> {
    const project_id = uuid();
    const actor = username;

    await this.freeDecisionPort.createProjectOfFreeDecision({
      id: project_id,
      title: normalizedTitle,
      question: data.question,
      decision: data.decision,
    });

    // Генерируем документ проекта решения
    const generatedDoc = await this.freeDecisionPort.generateProjectOfFreeDecisionDocument(
      {
        project_id,
        coopname: platformSettings().coopname,
        username: actor,
        registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id,
        title: normalizedTitle,
      },
      {}
    );

    // Публикуем проект решения в блокчейн сразу после генерации
    const documentForPublish: ISignedDocument = {
      version: this.getMetaString(generatedDoc.meta, 'version') || '1.0',
      hash: generatedDoc.hash,
      doc_hash: this.getMetaString(generatedDoc.meta, 'doc_hash') || generatedDoc.hash,
      meta_hash: this.getMetaString(generatedDoc.meta, 'meta_hash') || generatedDoc.hash,
      meta: generatedDoc.meta,
      signatures: this.getMetaSignatures(generatedDoc.meta),
    };

    await this.freeDecisionPort.publishProjectOfFreeDecision({
      coopname: platformSettings().coopname,
      username: actor,
      meta: JSON.stringify({ step: data.step, project_id, title: normalizedTitle }),
      document: documentForPublish,
    });

    // Сохраняем hash в конфиге для отображения на фронтенде — точечный merge
    // (не полная перезапись config), чтобы не потерять конкурентно записанные
    // флаги/хэши других шагов онбординга (lost update на общем jsonb-блобе).
    const updated = await this.extensionRepository.patchConfig('capital', {
      [hashKey]: generatedDoc.hash,
    } as Partial<CapitalOnboardingConfig>);

    return { project_id, hash: generatedDoc.hash, updated };
  }
}
