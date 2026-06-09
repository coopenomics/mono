import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { RemoteGraphQLDataSource } from '@apollo/gateway';
import { SubgraphRegistryModule } from './subgraph-registry.module';
import { SubgraphRegistryService } from './subgraph-registry.service';
import { SupergraphRefreshService } from './supergraph-refresh.service';
import { createDynamicSupergraphManager } from './supergraph-manager';
import { IntrospectionSupergraphComposer } from './supergraph-composer.impl';
import { loadAppConfig } from '../config/app-config';

/**
 * Apollo Federation Gateway tenant'а.
 *
 * Supergraph собирается динамически (Story 10.3b): dynamic supergraph
 * manager на каждый poll-tick перечитывает Postgres registry; при
 * изменении списка `(name, url)` — re-introspect'ит subgraph'ы и
 * swap'ает supergraph in-memory через gateway `update()`. Появление
 * НОВОГО subgraph'а после install не требует рестарта orchestrator'а.
 * `POST /v1/internal/composition/refresh` форсит recompose немедленно
 * (через {@link SupergraphRefreshService}).
 *
 * JWT forwarding: gateway получает Authorization-header от desktop,
 * прокидывает в каждый subgraph через willSendRequest. Subgraph'ы
 * валидируют JWT тем же секретом через @coopenomics/extension-sdk.
 */
@Module({
  imports: [
    SubgraphRegistryModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [SubgraphRegistryModule],
      inject: [SubgraphRegistryService, SupergraphRefreshService],
      useFactory: async (
        registry: SubgraphRegistryService,
        refresh: SupergraphRefreshService,
      ) => {
        const cfg = loadAppConfig();
        const initial = await registry.listForCompose();
        if (initial.length === 0) {
          throw new Error('[gateway] subgraph registry пуст — orchestrator должен seed core до boot gateway');
        }
        return {
          server: {
            path: '/v1/graphql',
            introspection: true,
            context: ({ req }: { req: unknown }) => ({ req }),
          },
          gateway: {
            supergraphSdl: async ({ update }: { update: (sdl: string) => void }) => {
              const manager = await createDynamicSupergraphManager(
                {
                  composer: new IntrospectionSupergraphComposer(),
                  registry,
                  pollIntervalMs: cfg.compositionPollIntervalMs,
                },
                update,
              );
              refresh.attach(manager);
              return { supergraphSdl: manager.initialSdl, cleanup: manager.cleanup };
            },
            buildService({ url }: { url?: string }) {
              return new RemoteGraphQLDataSource({
                url,
                willSendRequest({ request, context }) {
                  const incoming = (context as { req?: { headers?: Record<string, string> } })?.req?.headers ?? {};
                  const auth = incoming.authorization ?? incoming.Authorization;
                  if (auth && request.http) {
                    request.http.headers.set('authorization', auth);
                  }
                },
              });
            },
          },
        };
      },
    }),
  ],
  exports: [SubgraphRegistryModule],
})
export class GatewayModule {}
