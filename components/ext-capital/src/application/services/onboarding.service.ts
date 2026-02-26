import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { CapitalOnboardingStepInputDTO, CapitalOnboardingStepEnum, CapitalOnboardingStateDTO } from '../dto/onboarding.dto';
import type { IConfig } from '../../capital-extension.module';
import { FreeDecisionPort, FREE_DECISION_PORT } from '~/domain/free-decision/ports/free-decision.port';
import { Cooperative } from 'cooptypes';
import config from '~/config/config';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { DecisionTrackingPort, DECISION_TRACKING_PORT } from '~/domain/decision-tracking/ports/decision-tracking.port';
import { DecisionEventType } from '~/domain/decision-tracking/interfaces/tracking-rule-domain.interface';

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

@Injectable()
export class CapitalOnboardingService {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(FREE_DECISION_PORT) private readonly freeDecisionPort: FreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT) private readonly decisionTrackingPort: DecisionTrackingPort
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
        throw new Error(`Неизвестный шаг онбординга: ${step}`);
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
        throw new Error(`Неизвестный шаг онбординга: ${step}`);
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
        throw new Error(`Неизвестный шаг онбординга: ${step}`);
    }
  }

  private async loadPlugin(): Promise<ExtensionDomainEntity<IConfig & Record<string, any>>> {
    const plugin = await this.extensionRepository.findByName('capital');
    if (!plugin) throw new Error('Конфигурация расширения capital не найдена');
    const pluginConfig = { ...plugin.config } as IConfig & Record<string, any>;

    let needUpdate = false;
    if (!pluginConfig.onboarding_init_at) {
      pluginConfig.onboarding_init_at = new Date().toISOString();
      needUpdate = true;
    }

    if (!pluginConfig.onboarding_expire_at) {
      const start = new Date(pluginConfig.onboarding_init_at);
      const expire = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      pluginConfig.onboarding_expire_at = expire.toISOString();
      needUpdate = true;
    }

    if (needUpdate) {
      await this.extensionRepository.update({ ...plugin, config: pluginConfig });
      return { ...plugin, config: pluginConfig };
    }

    return { ...plugin, config: pluginConfig };
  }

  private buildState(pluginConfig: IConfig & Record<string, any>): CapitalOnboardingStateDTO {
    return {
      generator_program_template_done: !!pluginConfig.onboarding_generator_program_template_done,
      onboarding_generator_program_template_hash: pluginConfig.onboarding_generator_program_template_hash || null,
    generation_contract_template_done: !!pluginConfig.onboarding_generation_contract_template_done,
    onboarding_generation_contract_template_hash: pluginConfig.onboarding_generation_contract_template_hash || null,
    generator_offer_template_done: !!pluginConfig.onboarding_generator_offer_template_done,
    onboarding_generator_offer_template_hash: pluginConfig.onboarding_generator_offer_template_hash || null,
      blagorost_provision_done: !!pluginConfig.onboarding_blagorost_provision_done,
      onboarding_blagorost_provision_hash: pluginConfig.onboarding_blagorost_provision_hash || null,
      blagorost_offer_template_done: !!pluginConfig.onboarding_blagorost_offer_template_done,
      onboarding_blagorost_offer_template_hash: pluginConfig.onboarding_blagorost_offer_template_hash || null,
      onboarding_init_at: pluginConfig.onboarding_init_at || '',
      onboarding_expire_at: pluginConfig.onboarding_expire_at || '',
    };
  }

  public async getState(): Promise<CapitalOnboardingStateDTO> {
    const plugin = await this.loadPlugin();
    return this.buildState(plugin.config);
  }

  public async completeStep(data: CapitalOnboardingStepInputDTO, username: string): Promise<CapitalOnboardingStateDTO> {
    const plugin = await this.loadPlugin();
    const flagKey = this.mapStepToFlag(data.step);
    const hashKey = this.mapStepToHash(data.step);
    const normalizedTitle = data.title?.trim().substring(0, 200) || undefined;

    if ((plugin.config as any)[flagKey]) {
      return this.buildState(plugin.config);
    }
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
        coopname: config.coopname,
        username: actor,
        registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id,
        title: normalizedTitle,
      },
      {}
    );

    // Публикуем проект решения в блокчейн сразу после генерации
    const documentForPublish: ISignedDocumentDomainInterface = {
      version: (generatedDoc.meta as any)?.version || '1.0',
      hash: generatedDoc.hash,
      doc_hash: (generatedDoc.meta as any)?.doc_hash || generatedDoc.hash,
      meta_hash: (generatedDoc.meta as any)?.meta_hash || generatedDoc.hash,
      meta: generatedDoc.meta,
      signatures: (generatedDoc.meta as any)?.signatures || [],
    };

    await this.freeDecisionPort.publishProjectOfFreeDecision({
      coopname: config.coopname,
      username: actor,
      meta: JSON.stringify({ step: data.step, project_id, title: normalizedTitle }),
      document: documentForPublish,
    });

    // Сохраняем hash в конфиге для отображения на фронтенде
    const updatedConfig = {
      ...plugin.config,
      [hashKey]: generatedDoc.hash,
    };
    await this.extensionRepository.update({ ...plugin, config: updatedConfig });

    // Регистрируем правило отслеживания в фабрике
    const varsField = this.mapStepToVarsField(data.step);

    await this.decisionTrackingPort.registerTrackingRule({
      hash: generatedDoc.hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: varsField,
      metadata: {
        onboarding_step: data.step,
        project_id,
        extension: 'capital',
      },
    });

    return this.buildState(updatedConfig);
  }
}
