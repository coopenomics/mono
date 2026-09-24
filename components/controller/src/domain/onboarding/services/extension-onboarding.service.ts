import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ONBOARDING_COMPLETED_EVENT } from '@coopenomics/innercoop';
import { v4 as uuid } from 'uuid';
import { Cooperative } from 'cooptypes';
import { EXTENSION_REPOSITORY, type ExtensionDomainRepository, DomainError } from '@coopenomics/extension-kit';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { computeOnboardingExpiresAt } from '../constants/onboarding-ttl';
import {
  ONBOARDING_STEP_QUERY_PORT,
  type OnboardingStepQueryPort,
} from '../ports/onboarding-step-query.port';
import type { IExtensionOnboardingStepSpec } from '../dto/extension-onboarding-step-spec';
import config from '~/config/config';
import { DECISION_TRACKING_PORT, IDecisionTrackingPort, DecisionEventType } from '@coopenomics/innercoop';
import { FREE_DECISION_PORT, IFreeDecisionPort } from '@coopenomics/innercoop';
import { DocumentApprovalOnboardingAdapter } from '~/domain/document-approval/services/document-approval-onboarding.adapter';

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
    private readonly freeDecisionPort: IFreeDecisionPort,
    @Inject(DECISION_TRACKING_PORT)
    private readonly decisionTrackingPort: IDecisionTrackingPort,
    @Inject(ONBOARDING_STEP_QUERY_PORT)
    private readonly stepsRegistry: OnboardingStepQueryPort,
    private readonly documentApprovals: DocumentApprovalOnboardingAdapter,
    private readonly eventEmitter: EventEmitter2
  ) {}

  private async loadExtension(extension_name: string) {
    const extension = await this.extensionRepository.findByName(extension_name);
    if (!extension) {
      throw DomainError.internal('ONBOARDING_EXTENSION_NOT_FOUND', { extensionName: extension_name });
    }
    const extensionConfig: Record<string, unknown> = { ...extension.config };
    let needUpdate = false;

    if (!extensionConfig.onboarding_init_at) {
      extensionConfig.onboarding_init_at = new Date().toISOString();
      needUpdate = true;
    }
    if (!extensionConfig.onboarding_expire_at) {
      const start = new Date(extensionConfig.onboarding_init_at as string);
      extensionConfig.onboarding_expire_at = computeOnboardingExpiresAt(start);
      needUpdate = true;
    }
    if (needUpdate) {
      await this.extensionRepository.patchConfig(extension_name, {
        onboarding_init_at: extensionConfig.onboarding_init_at,
        onboarding_expire_at: extensionConfig.onboarding_expire_at,
      });
    }
    return { ...extension, config: extensionConfig };
  }

  /**
   * Дописывает отметки шагов, закрытых утверждением в цепи. Если дописана
   * последняя — подключение завершено: расширение перезапустится и доделает то,
   * что ждало решения совета.
   */
  private async persistHealedFlags(
    extension_name: string,
    healed: Record<string, boolean>,
    allDone: boolean
  ): Promise<void> {
    if (Object.keys(healed).length === 0) return;
    await this.extensionRepository.patchConfig(extension_name, healed);
    if (allDone) this.eventEmitter.emit(ONBOARDING_COMPLETED_EVENT, { extension_name });
  }

  public async getState(
    extension_name: string
  ): Promise<IExtensionOnboardingState> {
    const extension = await this.loadExtension(extension_name);
    const specs = this.stepsRegistry.getStepsByExtension(extension_name);

    // Шаг про документы считается пройденным и по утверждениям в цепи:
    // документы могли утвердить с вкладки «Шаблоны документов», минуя карточку.
    //
    // Отметку в настройке при этом дописываем, а не только показываем шаг
    // закрытым: по отметкам расширение решает, завершено ли подключение. Иначе
    // карточка говорит «всё принято», а расширение остаётся неподключённым.
    const steps: IExtensionOnboardingStepState[] = [];
    const healed: Record<string, boolean> = {};
    for (const spec of specs) {
      const flagged = Boolean(extension.config[doneKey(spec.step_key)]);
      const done = flagged || (await this.documentApprovals.isStepApproved(extension_name, spec.step_key));
      if (done && !flagged) healed[doneKey(spec.step_key)] = true;
      steps.push({
        step_key: spec.step_key,
        done,
        hash: (extension.config[hashKey(spec.step_key)] as string | undefined) || null,
        order: spec.order,
        default_title: spec.default_title ?? null,
      });
    }

    await this.persistHealedFlags(extension_name, healed, steps.every((s) => s.done));

    return {
      extension_name,
      steps,
      onboarding_init_at:
        (extension.config.onboarding_init_at as string | undefined) || '',
      onboarding_expire_at:
        (extension.config.onboarding_expire_at as string | undefined) || '',
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
      throw DomainError.internal('ONBOARDING_STEP_NOT_REGISTERED', { extensionName: input.extension_name, stepKey: input.step_key });
    }

    const extension = await this.loadExtension(input.extension_name);
    if (extension.config[doneKey(spec.step_key)]) {
      return this.getState(input.extension_name);
    }

    const storedHash = await this.runGenerator(spec, input, username);

    await this.extensionRepository.patchConfig(input.extension_name, {
      [hashKey(spec.step_key)]: storedHash,
    });

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
    throw DomainError.internal('ONBOARDING_UNKNOWN_STEP_GENERATOR', { generator: String(spec.generator) });
  }

  private async runFreeDecisionGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput,
    username: string
  ): Promise<string> {
    const viaFactory = await this.runFactoryGenerator(spec, input, username);
    if (viaFactory !== null) return viaFactory;

    if (!input.question || !input.decision) {
      throw DomainError.internal('ONBOARDING_FREE_DECISION_STEP_MISCONFIGURED', { extensionName: spec.extension_name, stepKey: spec.step_key });
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

    const documentForPublish: ISignedDocument = {
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

  /**
   * Шаг с объявленными документами ведёт фабрика утверждений: проект решения
   * собирается из текста в цепи, после решения утверждение фиксируется в цепи.
   * Текст из карточки не используется. `null` — у шага нет документов.
   */
  private async runFactoryGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput,
    username: string
  ): Promise<string | null> {
    const viaFactory = await this.documentApprovals.proposeOnboardingStep({
      extension_name: spec.extension_name,
      step_key: spec.step_key,
      username,
      title: input.title,
    });
    if (!viaFactory) return null;
    if (viaFactory.approved) {
      await this.extensionRepository.patchConfig(spec.extension_name, { [doneKey(spec.step_key)]: true });
    }
    return viaFactory.hash ?? '';
  }

  private async runMeetGenerator(
    spec: IExtensionOnboardingStepSpec,
    input: ICompleteExtensionOnboardingStepInput
  ): Promise<string> {
    if (!input.proposal_hash) {
      throw DomainError.internal('ONBOARDING_MEET_STEP_MISCONFIGURED', { extensionName: spec.extension_name, stepKey: spec.step_key });
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
