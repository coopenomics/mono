/**
 * @coopenomics/extension-sdk
 *
 * SDK для разработки backend-расширений Apollo Federation v2 subgraph'ов
 * экосистемы цифрового кооператива.
 *
 * Контракт:
 *   - расширение = Nest-приложение, использующее `ExtensionFederationModule`
 *     и `ExtensionAuthModule` в корневом AppModule.
 *   - schema собирается через autoSchemaFile { federation: 2 }.
 *   - cross-extension references на core entity (Cooperator, Cooperative,
 *     Account) — через `SharedCooperator/SharedCooperative/SharedAccount`
 *     stub'ы (`@key + @external`).
 *   - JWT валидируется тем же секретом что и core; gateway forward'ит
 *     Authorization-header в subgraph.
 *   - healthcheck `GET /_health` обязателен — orchestrator опрашивает.
 *
 * См. подробнее: docs/epics/E10-federation-runtime.md в репо apps-catalog
 * и Architecture v3 в blago.
 */

export {
  ExtensionFederationModule,
  type ExtensionFederationOptions,
} from './federation/federation.module';

export {
  ExtensionAuthModule,
  type ExtensionAuthOptions,
} from './auth/extension-auth.module';
export { ExtensionJwtStrategy, type ExtensionJwtPayload } from './auth/extension-jwt.strategy';
export { ExtensionJwtAuthGuard } from './auth/extension-jwt.guard';

export { SharedCooperator } from './entities/shared-cooperator.entity';
export { SharedCooperative } from './entities/shared-cooperative.entity';
export { SharedAccount } from './entities/shared-account.entity';

export { HealthController } from './health/health.controller';

export {
  loadExtensionConfig,
  ExtensionConfigError,
  type ExtensionConfig,
} from './config/extension-config';
