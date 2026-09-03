import { Module } from '@nestjs/common';
import { bucketProvidersFor } from '@coopenomics/extension-kit';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
import { ScheduleModule } from '@nestjs/schedule';
import { EdubridgeDatabaseModule } from '../infrastructure/database/edubridge-database.module';
import { ACCESS_CARRIER_CONNECTORS } from '../domain/connectors/access-carrier.connector';
import { EdubridgeChainAdapter } from '../infrastructure/adapters/edubridge-chain.adapter';
import { AccessCarrierRegistry } from '../infrastructure/connectors/access-carrier.registry';
import { GetCourseConnector } from '../infrastructure/connectors/getcourse.connector';
import { OnsiteConnector } from '../infrastructure/connectors/onsite.connector';
import { SkillspaceConnector } from '../infrastructure/connectors/skillspace.connector';
import { EdubridgeAccessTaskRepository } from '../infrastructure/repositories/edubridge-access-task.repository';
import { EdubridgeConnectorBindingRepository } from '../infrastructure/repositories/edubridge-connector-binding.repository';
import { EdubridgeCourseRepository } from '../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../infrastructure/repositories/edubridge-learner.repository';
import { EdubridgeTeacherRepository } from '../infrastructure/repositories/edubridge-teacher.repository';
import { EdubridgeAdminRepository } from '../infrastructure/repositories/edubridge-admin.repository';
import { EDUBRIDGE_CHAIN_PORT } from '../domain/ports/edubridge-chain.port';
import { EdubridgeConfigHolder } from './config/edubridge-config.holder';
import { EdubridgeDesktopGrantsProvider } from './desktop/edubridge-desktop-grants.provider';
import { EdubridgeAccessGuard } from './guards/edubridge-access.guard';
import { EdubridgeMembershipService } from './membership/edubridge-membership.service';
import { EdubridgeNamesService } from './membership/edubridge-names.service';
import { EDUBRIDGE_ROLE_FACTS_PORT } from './membership/edubridge-role-facts.port';
import { EdubridgeRoleFactsAdapter } from './membership/edubridge-role-facts.adapter';
import { EdubridgeUdataParametersAdapter } from './registration/edubridge-udata-parameters.adapter';
import { EdubridgeCapitalNarrowingPolicy } from './policies/edubridge-capital-narrowing.policy';
import { EdubridgeCatalogResolver } from './resolvers/edubridge-catalog.resolver';
import { EdubridgeCourseAdminResolver } from './resolvers/edubridge-course-admin.resolver';
import { EdubridgeAccessListener } from './listeners/edubridge-access.listener';
import { EdubridgeApprovalListener } from './listeners/edubridge-approval.listener';
import { EdubridgeMembershipExitListener } from './listeners/edubridge-membership-exit.listener';
import { EdubridgeNotificationListener } from './listeners/edubridge-notification.listener';
import { EdubridgeOwnerDirectory } from './membership/edubridge-owner.directory';
import { EdubridgeMemberResolver } from './resolvers/edubridge-member.resolver';
import { EdubridgeAccessOutboxService } from './services/edubridge-access-outbox.service';
import { EdubridgeExpiryWorker } from './workers/edubridge-expiry.worker';
import { EdubridgeOutboxWorker } from './workers/edubridge-outbox.worker';
import { EdubridgeOnboardingResolver } from './resolvers/edubridge-onboarding.resolver';
import { EdubridgeAdminResolver } from './resolvers/edubridge-admin.resolver';
import { EdubridgeTeacherResolver } from './resolvers/edubridge-teacher.resolver';
import { EdubridgeAdminService } from './services/edubridge-admin.service';
import { EdubridgeTeacherService } from './services/edubridge-teacher.service';
import { EdubridgeEnrollmentService } from './services/edubridge-enrollment.service';
import { EdubridgeLearnerService } from './services/edubridge-learner.service';
import { EdubridgeOnboardingService } from './services/edubridge-onboarding.service';
import { EdubridgeCourseService } from './services/edubridge-course.service';
import { EdubridgeCourseImagesService } from './services/edubridge-course-images.service';
import { EdubridgeCatalogCourseFieldsResolver, EdubridgeCourseFieldsResolver } from './resolvers/edubridge-course-fields.resolver';

/** Слой приложения: резолверы, сервисы, доступ, провайдер грантов, политики. */
@Module({
  // ScheduleModule.forRoot() идемпотентен: AppModule уже инициализировал планировщик.
  imports: [EdubridgeDatabaseModule, ScheduleModule.forRoot()],
  providers: [
    EdubridgeConfigHolder,
    { provide: EDUBRIDGE_ROLE_FACTS_PORT, useClass: EdubridgeRoleFactsAdapter },
    EdubridgeUdataParametersAdapter,
    EdubridgeMembershipService,
    EdubridgeNamesService,
    EdubridgeAccessGuard,
    EdubridgeDesktopGrantsProvider,
    EdubridgeCapitalNarrowingPolicy,
    // Репозитории и адаптеры
    EdubridgeCourseRepository,
    EdubridgeLearnerRepository,
    EdubridgeEnrollmentRepository,
    EdubridgeAccessTaskRepository,
    EdubridgeTeacherRepository,
    EdubridgeAdminRepository,
    EdubridgeConnectorBindingRepository,
    { provide: EDUBRIDGE_CHAIN_PORT, useClass: EdubridgeChainAdapter },
    // Коннекторы площадок — фабрика по носителю; новая площадка = новый класс в списке
    SkillspaceConnector,
    GetCourseConnector,
    OnsiteConnector,
    {
      provide: ACCESS_CARRIER_CONNECTORS,
      useFactory: (s: SkillspaceConnector, g: GetCourseConnector, o: OnsiteConnector) => [s, g, o],
      inject: [SkillspaceConnector, GetCourseConnector, OnsiteConnector],
    },
    AccessCarrierRegistry,
    EdubridgeOwnerDirectory,
    // Сервисы
    // Обложки курсов — bucket ядра (`FILE_STORAGE_PORT`), как изображения товара в «Столе заказов».
    ...bucketProvidersFor(FILE_STORAGE_PORT, [EdubridgeCourseImagesService]),
    EdubridgeCourseImagesService,
    EdubridgeCourseService,
    EdubridgeOnboardingService,
    EdubridgeLearnerService,
    EdubridgeEnrollmentService,
    EdubridgeAccessOutboxService,
    EdubridgeTeacherService,
    EdubridgeAdminService,
    // Воркеры и слушатели
    EdubridgeOutboxWorker,
    EdubridgeExpiryWorker,
    EdubridgeAccessListener,
    EdubridgeApprovalListener,
    EdubridgeMembershipExitListener,
    EdubridgeNotificationListener,
    // Резолверы
    EdubridgeCatalogResolver,
    EdubridgeCatalogCourseFieldsResolver,
    EdubridgeCourseFieldsResolver,
    EdubridgeCourseAdminResolver,
    EdubridgeOnboardingResolver,
    EdubridgeMemberResolver,
    EdubridgeTeacherResolver,
    EdubridgeAdminResolver,
  ],
  exports: [EDUBRIDGE_ROLE_FACTS_PORT, EdubridgeConfigHolder, EdubridgeMembershipService],
})
export class EdubridgeApplicationModule {}
