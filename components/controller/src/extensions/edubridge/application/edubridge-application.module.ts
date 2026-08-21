import { Module } from '@nestjs/common';
import { EdubridgeDatabaseModule } from '../infrastructure/database/edubridge-database.module';
import { EdubridgeCourseRepository } from '../infrastructure/repositories/edubridge-course.repository';
import { EdubridgeConfigHolder } from './config/edubridge-config.holder';
import { EdubridgeDesktopGrantsProvider } from './desktop/edubridge-desktop-grants.provider';
import { EdubridgeAccessGuard } from './guards/edubridge-access.guard';
import { EdubridgeMembershipService } from './membership/edubridge-membership.service';
import { EDUBRIDGE_ROLE_FACTS_PORT } from './membership/edubridge-role-facts.port';
import { EdubridgeRoleFactsStub } from './membership/edubridge-role-facts.stub';
import { EdubridgeCapitalNarrowingPolicy } from './policies/edubridge-capital-narrowing.policy';
import { EdubridgeCatalogResolver } from './resolvers/edubridge-catalog.resolver';
import { EdubridgeCourseAdminResolver } from './resolvers/edubridge-course-admin.resolver';
import { EdubridgeCourseService } from './services/edubridge-course.service';

/** Слой приложения: резолверы, сервисы, доступ, провайдер грантов, политики. */
@Module({
  imports: [EdubridgeDatabaseModule],
  providers: [
    EdubridgeConfigHolder,
    { provide: EDUBRIDGE_ROLE_FACTS_PORT, useClass: EdubridgeRoleFactsStub },
    EdubridgeMembershipService,
    EdubridgeAccessGuard,
    EdubridgeDesktopGrantsProvider,
    EdubridgeCapitalNarrowingPolicy,
    // Репозитории
    EdubridgeCourseRepository,
    // Сервисы
    EdubridgeCourseService,
    // Резолверы
    EdubridgeCatalogResolver,
    EdubridgeCourseAdminResolver,
  ],
  exports: [EDUBRIDGE_ROLE_FACTS_PORT, EdubridgeConfigHolder, EdubridgeMembershipService],
})
export class EdubridgeApplicationModule {}
