import { Module } from '@nestjs/common';
import { EdubridgeDatabaseModule } from '../infrastructure/database/edubridge-database.module';
import { EdubridgeChainAdapter } from '../infrastructure/adapters/edubridge-chain.adapter';
import { EdubridgeCourseRepository } from '../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeEnrollmentRepository } from '../infrastructure/repositories/edubridge-enrollment.repository';
import { EdubridgeLearnerRepository } from '../infrastructure/repositories/edubridge-learner.repository';
import { EDUBRIDGE_CHAIN_PORT } from '../domain/ports/edubridge-chain.port';
import { EdubridgeConfigHolder } from './config/edubridge-config.holder';
import { EdubridgeDesktopGrantsProvider } from './desktop/edubridge-desktop-grants.provider';
import { EdubridgeAccessGuard } from './guards/edubridge-access.guard';
import { EdubridgeMembershipService } from './membership/edubridge-membership.service';
import { EDUBRIDGE_ROLE_FACTS_PORT } from './membership/edubridge-role-facts.port';
import { EdubridgeRoleFactsAdapter } from './membership/edubridge-role-facts.adapter';
import { EdubridgeUdataParametersAdapter } from './registration/edubridge-udata-parameters.adapter';
import { EdubridgeCapitalNarrowingPolicy } from './policies/edubridge-capital-narrowing.policy';
import { EdubridgeCatalogResolver } from './resolvers/edubridge-catalog.resolver';
import { EdubridgeCourseAdminResolver } from './resolvers/edubridge-course-admin.resolver';
import { EdubridgeMemberResolver } from './resolvers/edubridge-member.resolver';
import { EdubridgeOnboardingResolver } from './resolvers/edubridge-onboarding.resolver';
import { EdubridgeEnrollmentService } from './services/edubridge-enrollment.service';
import { EdubridgeLearnerService } from './services/edubridge-learner.service';
import { EdubridgeOnboardingService } from './services/edubridge-onboarding.service';
import { EdubridgeCourseService } from './services/edubridge-course.service';

/** Слой приложения: резолверы, сервисы, доступ, провайдер грантов, политики. */
@Module({
  imports: [EdubridgeDatabaseModule],
  providers: [
    EdubridgeConfigHolder,
    { provide: EDUBRIDGE_ROLE_FACTS_PORT, useClass: EdubridgeRoleFactsAdapter },
    EdubridgeUdataParametersAdapter,
    EdubridgeMembershipService,
    EdubridgeAccessGuard,
    EdubridgeDesktopGrantsProvider,
    EdubridgeCapitalNarrowingPolicy,
    // Репозитории и адаптеры
    EdubridgeCourseRepository,
    EdubridgeLearnerRepository,
    EdubridgeEnrollmentRepository,
    { provide: EDUBRIDGE_CHAIN_PORT, useClass: EdubridgeChainAdapter },
    // Сервисы
    EdubridgeCourseService,
    EdubridgeOnboardingService,
    EdubridgeLearnerService,
    EdubridgeEnrollmentService,
    // Резолверы
    EdubridgeCatalogResolver,
    EdubridgeCourseAdminResolver,
    EdubridgeOnboardingResolver,
    EdubridgeMemberResolver,
  ],
  exports: [EDUBRIDGE_ROLE_FACTS_PORT, EdubridgeConfigHolder, EdubridgeMembershipService],
})
export class EdubridgeApplicationModule {}
