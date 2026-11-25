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
/** Отказ связи шлюза с частью схемы: в тексте — адрес контейнера и причина сети. */
const SUBGRAPH_TRANSPORT_FAILURE = /request to https?:\/\/\S+ failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up/i;

/**
 * Ошибку связи с ядром или приложением клиент получает без внутренних
 * адресов. Отказы самих сервисов (права, проверка данных) проходят как есть:
 * их текст и код предназначены пайщику.
 */
export function maskSubgraphFailure<T extends { message: string; extensions?: Record<string, unknown> }>(formatted: T): T {
  if (!SUBGRAPH_TRANSPORT_FAILURE.test(formatted.message)) return formatted;
  return {
    ...formatted,
    message: 'Часть сервиса временно недоступна. Повторите запрос позже.',
    extensions: { code: 'SERVICE_UNAVAILABLE' },
  };
}

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
            // Трассировка стека и адреса контейнеров наружу не отдаются: при
            // упавшем приложении клиент получал «connect ECONNREFUSED
            // 172.18.0.15:3011» вместе со стеком шлюза (25.11.2026).
            includeStacktraceInErrorResponses: false,
            formatError: maskSubgraphFailure,
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
              // Межсервисный секрет (провайдер вызывает initSystem узла,
              // хаб — служебные мутации) получает только ядро: подграф
              // приложения — чужой код, секрет ему не передаётся.
              const isCore = url === loadAppConfig().coreSubgraphUrl;
              return new RemoteGraphQLDataSource({
                url,
                willSendRequest({ request, context }) {
                  const incoming = (context as { req?: { headers?: Record<string, string> } })?.req?.headers ?? {};
                  const auth = incoming.authorization ?? incoming.Authorization;
                  if (auth && request.http) {
                    request.http.headers.set('authorization', auth);
                  }
                  const secret = incoming['server-secret'];
                  if (isCore && secret && request.http) {
                    request.http.headers.set('server-secret', secret);
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
