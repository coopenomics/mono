import './i18n';
import { Inject, Module, Optional } from '@nestjs/common';
import { merge } from 'lodash';
import { BaseExtensionModule, EXTENSION_REPOSITORY, platformSettings, type ExtensionDomainEntity, type ExtensionDomainRepository, DomainError } from '@coopenomics/extension-kit';
import {
  COUNCIL_PORT,
  DOCUMENT_DECLARATION_PORT,
  LOGGER_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  MEMBER_EXIT_REGISTRY_PORT,
  REGISTRATION_REGISTRY_PORT,
  type ICouncilPort,
  type IDocumentDeclarationPort,
  type ILoggerPort,
  type IOnboardingStepRegistryPort,
  type IMemberExitRegistryPort,
  type IRegistrationRegistryPort,
} from '@coopenomics/innercoop';
import { EdubridgeApplicationModule } from './application/edubridge-application.module';
import { EdubridgeExitBlockersService } from './application/services/edubridge-exit-blockers.service';
import { EdubridgeLiveFeedService } from './application/services/edubridge-live-feed.service';
import { EdubridgeTeacherService } from './application/services/edubridge-teacher.service';
import { EdubridgeSectionsService } from './application/services/edubridge-sections.service';
import { EdubridgeConfigHolder } from './application/config/edubridge-config.holder';
import { registerEdubridgeDocuments } from './application/onboarding/register-edubridge-documents';
import { registerEdubridgeOnboardingSteps } from './application/onboarding/register-edubridge-onboarding-steps';
import { registerEdubridgeInAgreementRegistry } from './application/registration/register-edubridge-in-agreement-registry';
import { EDUBRIDGE_EXTENSION_NAME } from './constants/edubridge.constants';
import {
  EDU_ONBOARDING_STEPS,
  EDU_PARENT_AGREEMENT_TYPE,
  EDU_TEACHER_AGREEMENT_TYPE,
} from './constants/edubridge-agreement-ids';
import { EdubridgeDatabaseModule } from './infrastructure/database/edubridge-database.module';
import { defaultConfig, type IConfig, Schema } from './types';
import { t } from './i18n';

/**
 * Расширение «Образовательный мост» (edubridge).
 *
 * Соединяет кооператив с образовательными площадками: каталог курсов,
 * вступление по офертам родителя-слушателя и преподавателя, членские взносы
 * через конвертацию паевого, автоматическая выдача и отзыв доступа,
 * преподавательский контур (ДУХД, взносы РИД).
 */
export class EdubridgeExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(COUNCIL_PORT) private readonly council: ICouncilPort,
    @Inject(ONBOARDING_STEP_REGISTRY_PORT) private readonly onboardingSteps: IOnboardingStepRegistryPort,
    @Inject(DOCUMENT_DECLARATION_PORT) private readonly documentDeclarations: IDocumentDeclarationPort,
    @Optional() @Inject(REGISTRATION_REGISTRY_PORT) private readonly registration: IRegistrationRegistryPort | null = null,
    @Optional() @Inject(MEMBER_EXIT_REGISTRY_PORT) private readonly memberExit: IMemberExitRegistryPort | null = null,
    private readonly configHolder: EdubridgeConfigHolder,
    private readonly exitBlockers: EdubridgeExitBlockersService,
    private readonly liveFeed: EdubridgeLiveFeedService,
    private readonly teacherService: EdubridgeTeacherService,
    private readonly sections: EdubridgeSectionsService
  ) {
    super();
    this.logger.setContext(EdubridgeExtension.name);
  }

  name = EDUBRIDGE_EXTENSION_NAME;
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('EDUBRIDGE_EXTENSION_CONFIG_NOT_FOUND');
    this.extension = { ...extensionData, config: merge({}, defaultConfig, extensionData.config) };
    this.configHolder.set(this.extension.config);

    await this.ensurePrograms();
    registerEdubridgeOnboardingSteps(this.onboardingSteps);
    await registerEdubridgeDocuments(this.documentDeclarations);
    await this.syncCoopAcceptanceFromOnboarding();
    this.registerInAgreementRegistry();
    this.registerExitBlockers();
    // Живое обновление столов: таблицы в ленте изменений и состав персонала.
    this.liveFeed.declareTables();
    await this.liveFeed.refreshStaff(platformSettings().coopname);
    // Раздел и уровень курсов, заполненные строками до справочника (7DD-23), —
    // переносим в справочник: курсы получают ссылки. Идемпотентно.
    const migrated = await this.sections.migrateLegacyCourses(platformSettings().coopname);
    if (migrated) this.logger.info(`[EDU.SECTIONS] курсов перенесено в справочник разделов и уровней: ${migrated}`);
    // Курсы, где преподаватели указаны до появления черновиков назначений, —
    // досоздаём черновики, чтобы преподавателю было что подписать.
    await this.teacherService.syncAllCourseAssignments(platformSettings().coopname);
    this.logger.info('edubridge-extension готов');
  }

  /** Две программы в реестре кооператива — по виду соглашения каждой оферты. */
  private async ensurePrograms(): Promise<void> {
    const coopname = platformSettings().coopname;
    for (const [type, title] of [
      [EDU_PARENT_AGREEMENT_TYPE, t('edubridge.edubridgeExtension.program.learningTitle')],
      [EDU_TEACHER_AGREEMENT_TYPE, t('edubridge.edubridgeExtension.program.teachingTitle')],
    ] as const) {
      try {
        const { created, program_id } = await this.council.ensureProgram({ coopname, type, title });
        if (created) this.logger.info(`[EDU.L1] программа ${type} открыта в кооперативе ${coopname} (program_id=${program_id})`);
      } catch (error) {
        this.logger.error(`[EDU.L1] не удалось открыть программу ${type}: ${(error as Error)?.message ?? error}`);
      }
    }
  }

  /** Все четыре решения совета приняты → ЦПП принята кооперативом. */
  private async syncCoopAcceptanceFromOnboarding(): Promise<void> {
    const cfg = this.extension.config as unknown as Record<string, unknown>;
    const allDone = Object.values(EDU_ONBOARDING_STEPS).every((step) => Boolean(cfg[`onboarding_${step}_done`]));
    if (!allDone || this.extension.config.coopAcceptance.accepted) return;

    const acceptedAt = (cfg[`onboarding_${EDU_ONBOARDING_STEPS.CONTRACT_TEMPLATE}_at`] as string | undefined) || new Date().toISOString();
    const merged = await this.extensionRepository.patchConfig(this.name, {
      coopAcceptance: { accepted: true, accepted_at: acceptedAt },
    });
    this.extension = { ...this.extension, config: merged.config };
    this.configHolder.set(this.extension.config);
    this.logger.info('[EDU.L1] coopAcceptance.accepted выставлен по завершению онбординга совета');
  }

  /**
   * Почему преподавателю рано выходить из кооператива — ядро спросит об этом
   * перед подачей заявления о выходе.
   */
  private registerExitBlockers(): void {
    if (!this.memberExit) {
      this.logger.info('[EDU.L2] реестр проверок выхода не предоставлен — обязательства преподавателя не проверяются');
      return;
    }
    this.memberExit.registerExitBlockers(this.exitBlockers);
  }

  private registerInAgreementRegistry(): void {
    if (!this.registration) {
      this.logger.info('[EDU.L2] реестр оферт вступления не предоставлен — программы не предлагаются');
      return;
    }
    if (!this.extension.config.coopAcceptance.accepted) {
      this.logger.info('[EDU.L2] ЦПП ещё не принята советом — оферты вступления не регистрируются');
      return;
    }
    registerEdubridgeInAgreementRegistry(this.registration);
    this.logger.info('[EDU.L2] программы «Обучение» и «Преподавание» зарегистрированы в витрине вступления');
  }
}

@Module({
  imports: [EdubridgeDatabaseModule, EdubridgeApplicationModule],
  providers: [EdubridgeExtension],
  exports: [EdubridgeExtension],
})
export class EdubridgeExtensionModule {
  constructor(private readonly edubridgeExtension: EdubridgeExtension) {}

  async initialize() {
    await this.edubridgeExtension.initialize();
  }
}
