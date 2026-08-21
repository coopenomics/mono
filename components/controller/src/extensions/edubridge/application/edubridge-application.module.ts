import { Module } from '@nestjs/common';
import { EdubridgeConfigHolder } from './config/edubridge-config.holder';
import { EdubridgeDesktopGrantsProvider } from './desktop/edubridge-desktop-grants.provider';
import { EdubridgeCapitalNarrowingPolicy } from './policies/edubridge-capital-narrowing.policy';
import { EDUBRIDGE_ROLE_FACTS_PORT } from './membership/edubridge-role-facts.port';
import { EdubridgeRoleFactsStub } from './membership/edubridge-role-facts.stub';

/** Слой приложения: резолверы, сервисы, провайдер грантов. */
@Module({
  providers: [
    EdubridgeConfigHolder,
    EdubridgeDesktopGrantsProvider,
    EdubridgeCapitalNarrowingPolicy,
    { provide: EDUBRIDGE_ROLE_FACTS_PORT, useClass: EdubridgeRoleFactsStub },
  ],
  exports: [EDUBRIDGE_ROLE_FACTS_PORT, EdubridgeConfigHolder],
})
export class EdubridgeApplicationModule {}
