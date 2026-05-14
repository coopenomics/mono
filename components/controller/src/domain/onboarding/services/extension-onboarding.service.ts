import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Cooperative } from 'cooptypes';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import {
  FREE_DECISION_PORT,
  type FreeDecisionPort,
} from '~/domain/free-decision/ports/free-decision.port';
import {
  DECISION_TRACKING_PORT,
  type DecisionTrackingPort,
} from '~/domain/decision-tracking/ports/decision-tracking.port';
import { DecisionEventType } from '~/domain/decision-tracking/interfaces/tracking-rule-domain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { computeOnboardingExpiresAt } from '../constants/onboarding-ttl';
import {
  ONBOARDING_STEP_QUERY_PORT,
  type OnboardingStepQueryPort,
} from '../ports/onboarding-step-query.port';
import type { IExtensionOnboardingStepSpec } from '../dto/extension-onboarding-step-spec';
import config from '~/config/config';

export interface IExtensionOnboardingStepState {
  step_key: string;
  done: boolean;
  hash: string | null;
  order: number;
  default_title: string | null;
}

export interface IExtensionOnboardingState {
  extension_name: string;
  steps: IExtensionOnboardingStepState[];
  onboarding_init_at: string;
  onboarding_expire_at: string;
  all_done: boolean;
}

export interface ICompleteExtensionOnboardingStepInput {
  extension_name: string;
  step_key: string;
  title?: string;
  /** Текст вопроса предлагаемого решения. Обязателен для generator=free_decision. */
  question?: string;
  /** Текст принимаемого решения. Обязателен для generator=free_decision. */
  decision?: string;
  /** Hash повестки общего собрания. Обязателен для generator=meet. */
  proposal_hash?: string;
}

const doneKey = (step_key: string) => `onboarding_${step_key}_done`;
const hashKey = (step_key: string) => `onboarding_${step_key}_hash`;

/**
 * Generic-сервис онбординга кооператива на расширение.
 *
 * Шаги задаются расширением декларативно через
 * OnboardingStepsRegistry в момент initialize(). Платформенный слой
 * выполняет общий flow (free-decision/meet → tracking-rule →
 * сохранение hash в extension.config) и собирает state из полей
 * `onboarding_<step_key>_done` / `_hash` — те же ключи, что
 * используют legacy chairman/capital, чтобы старые и новые resolver'ы
 * сходились на единой config-истине.
 */
@Injectable()
export class ExtensionOnboardingService {
  constructor(
    @Inject(EXTENSION_REPOSITORY)
    private readonly extensionRepository: ExtensionDomainRepository<
      Record<string, unknown>
    >,
    @Inject(FREE_DECISION_PORT)
    private readonly freeDecisionPort: FreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT)
    private readonly decisionTrackingPort: DecisionTrackingPort,
    @Inject(ONBOARDING_STEP_QUERY_PORT)
    private readonly stepsRegistry: OnboardingStepQueryPort
  ) {}

  private async loadPlugin(extension_name: string) {
    const plugin = await this.extensionRepository.findByName(extension_name);
    if (!plugin) {
      throw new Error(`Расширение не найдено: ${extension_name}`);
    }
    const pluginConfig: Record<string, unknown> = { ...plugin.config };
    let needUpdate = false;

    if (!pluginConfig.onboarding_init_at) {
      pluginConfig.onboarding_init_at = new Date().toISOString();
      needUpdate = true;
    }
    if (!pluginConfig.onboarding_expire_at) {
      const start = new Date(pluginConfig.onboarding_init_at as string);
      pluginConfig.onboarding_expire_at = computeOnboardingExpiresAt(start);
      needUpdate = true;
    }
    if (needUpdate) {
      await this.extensionRepository.update({ ...plugin, config: pluginConfig });
    }
    return { ...plugin, config: pluginConfig };
  }

  public async getState(
    extension_name: string
  ): Promise<IExtensionOnboardingState> {
    const plugin = await this.loadPlugin(extension_name);
    const specs = this.stepsRegistry.getStepsByExtension(extension_name);

    const steps: IExtensionOnboardingStepState[] = specs.map((spec) => ({
      step_key: spec.step_key,
      done: Boolean(plugin.config[doneKey(spec.step_key)]),
      hash:
        (plugin.config[hashKey(spec.step_key)] as string | undefined) || null,
      order: spec.order,
      default_title: spec.default_title ?? null,
    }));

    return {
      extension_name,
      steps,
      onboarding_init_at:
        (plugin.config.onboarding_init_at as string | undefined) || '',
      onboarding_expire_at:
        (plugin.config.onboarding_expire_at as string | undefined) || '',
      all_done: steps.length > 0 && steps.every((s) => s.done),
    };
  }

  public async completeStep(
    input: ICompleteExtensionOnboardingStepInput,
    username: string
  ): Promise<IExtensionOnboardingState> {
    const spec = this.stepsRegistry.getStep(
      input.extension_name,
      input.step_key
    );
    if (!spec) {
      throw new Error(
        `Шаг онбординга не зарегистрирован: ${input.extension_name}/${input.step_key}`
      );
    }

    const plugin = await this.loadPlugin(input.extension_name);
    if (plugin.config[doneKey(spec.step_key)]) {
      return this.getState(input.extension_name);
    }

    const storedHash = await this.runGenerator(spec, input, username);

    const updatedConfig: Record<string, unknown> = {
      ...plugin.config,
      [hashKey(spec.step_key)]: storedHash,
    };
    await this.extensionRepository.update({ ...plugin, config: updatedConfig });

    return this.getState(input.extension_name);
  }

  private async runGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput,
    username: string
  ): Promise<string> {
    if (spec.generator === 'free_decision') {
      return this.runFreeDecisionGenerator(spec, input, username);
    }
    if (spec.generator === 'meet') {
      return this.runMeetGenerator(spec, input);
    }
    throw new Error(
      `Неизвестный generator шага онбординга: ${String(spec.generator)}`
    );
  }

  private async runFreeDecisionGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput,
    username: string
  ): Promise<string> {
    if (!input.question || !input.decision) {
      throw new Error(
        `Шаг ${spec.extension_name}/${spec.step_key} (generator='free_decision') требует question и decision`
      );
    }
    const normalizedTitle =
      input.title?.trim().substring(0, 200) || spec.default_title;
    const project_id = uuid();

    await this.freeDecisionPort.createProjectOfFreeDecision({
      id: project_id,
      title: normalizedTitle,
      question: input.question,
      decision: input.decision,
    });

    const generatedDoc =
      await this.freeDecisionPort.generateProjectOfFreeDecisionDocument(
        {
          project_id,
          coopname: config.coopname,
          username,
          registry_id: Cooperative.Registry.ProjectFreeDecision.registry_id,
          title: normalizedTitle,
        },
        {}
      );

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
      username,
      meta: JSON.stringify({
        step: spec.step_key,
        project_id,
        title: normalizedTitle,
        extension: input.extension_name,
      }),
      document: documentForPublish,
    });

    await this.decisionTrackingPort.registerTrackingRule({
      hash: generatedDoc.hash,
      event_type: DecisionEventType.SOVIET_DECISION,
      vars_field: spec.vars_field,
      metadata: {
        onboarding_step: spec.step_key,
        project_id,
        extension: input.extension_name,
      },
    });

    return generatedDoc.hash;
  }

  private async runMeetGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput
  ): Promise<string> {
    if (!input.proposal_hash) {
      throw new Error(
        `Шаг ${spec.extension_name}/${spec.step_key} (generator='meet') требует proposal_hash`
      );
    }
    await this.decisionTrackingPort.registerTrackingRule({
      hash: input.proposal_hash,
      event_type: DecisionEventType.MEET_DECISION,
      vars_field: spec.vars_field,
      metadata: {
        onboarding_step: spec.step_key,
        extension: input.extension_name,
      },
    });
    return input.proposal_hash;
  }
}
