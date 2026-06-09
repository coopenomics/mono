import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { SubgraphRegistryEntity } from './subgraph-registry.entity';
import { SubgraphRegistryService } from './subgraph-registry.service';

/**
 * Apollo Federation Gateway tenant'а.
 *
 * IntrospectAndCompose читает active subgraph'ы из Postgres registry с
 * periodic polling. Gateway не перезагружается при появлении нового
 * subgraph'а — он re-introspect'ит и swap'ает supergraph in-memory.
 *
 * JWT forwarding: gateway получает Authorization-header от desktop,
 * прокидывает в каждый subgraph через willSendRequest. Subgraph'ы
 * валидируют JWT тем же секретом через @coopenomics/extension-sdk.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SubgraphRegistryEntity]),
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [TypeOrmModule.forFeature([SubgraphRegistryEntity])],
      inject: [SubgraphRegistryService],
      useFactory: async (registry: SubgraphRegistryService) => {
        // MVP-режим: subgraphs читаются из Postgres registry один раз на
        // bootstrap. IntrospectAndCompose делает polling existing endpoints
        // и автоматически re-compose'ит если у subgraph'а изменилась схема.
        //
        // Но: добавление НОВОГО subgraph'а (POST /v1/internal/extensions/install)
        // потребует рестарта контейнера orchestrator. На MVP это
        // ОК — gateway маленький, warmup ~5 сек, делается orchestrator-pipeline
        // при первом install'е приложения (Story 10.4).
        //
        // Полностью dynamic supergraph composition (без рестарта) — отдельная
        // story 10.3b: custom SupergraphManager, который опрашивает registry
        // на каждый poll и собирает supergraphSdl.fetch().
        const subgraphs = await registry.listForCompose();
        if (subgraphs.length === 0) {
          throw new Error('[gateway] subgraph registry пуст — orchestrator должен seed core до boot gateway');
        }
        return {
          server: {
            path: '/v1/graphql',
            introspection: true,
            context: ({ req }: { req: unknown }) => ({ req }),
          },
          gateway: {
            supergraphSdl: new IntrospectAndCompose({
              subgraphs,
              pollIntervalInMs: 10000,
            }),
            buildService({ url }) {
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
  providers: [SubgraphRegistryService],
  exports: [SubgraphRegistryService, TypeOrmModule],
})
export class GatewayModule {}
