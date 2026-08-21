import { Module } from '@nestjs/common';
import { EdubridgeDesktopGrantsProvider } from './desktop/edubridge-desktop-grants.provider';
import { EDUBRIDGE_ROLE_FACTS_PORT } from './membership/edubridge-role-facts.port';
import { EdubridgeRoleFactsStub } from './membership/edubridge-role-facts.stub';

/** Слой приложения: резолверы, сервисы, провайдер грантов. */
@Module({
  providers: [
    EdubridgeDesktopGrantsProvider,
    { provide: EDUBRIDGE_ROLE_FACTS_PORT, useClass: EdubridgeRoleFactsStub },
  ],
  exports: [EDUBRIDGE_ROLE_FACTS_PORT],
})
export class EdubridgeApplicationModule {}
