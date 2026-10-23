/**
 * @fileoverview Реальный импл {@link SupergraphComposerPort} — Story 10.3b.
 *
 * Для каждого subgraph'а из registry делает federation-introspection
 * (`{ _service { sdl } }` — стандартный механизм Apollo Federation,
 * его отдаёт и coopback на `ApolloFederationDriver`, и расширения на
 * `@coopenomics/extension-sdk`), затем собирает supergraph SDL через
 * `@apollo/composition.composeServices` — той же библиотекой, которой
 * пользуется `IntrospectAndCompose` внутри Apollo Gateway.
 *
 * Ошибки композиции (несовместимые схемы, недоступный subgraph)
 * пробрасываются наверх — менеджер не обновляет fingerprint и
 * повторит попытку на следующем tick'е.
 */
import { Logger } from '@nestjs/common';
import { parse } from 'graphql';
import { composeServices } from '@apollo/composition';
import type { SupergraphComposerPort } from './supergraph-manager';
import type { SubgraphDescriptor } from './subgraph-registry.service';

const SDL_QUERY = '{ _service { sdl } }';
const REQUEST_TIMEOUT_MS = 10_000;

export class IntrospectionSupergraphComposer implements SupergraphComposerPort {
  private readonly logger = new Logger(IntrospectionSupergraphComposer.name);

  async compose(subgraphs: ReadonlyArray<SubgraphDescriptor>): Promise<string> {
    const services = await Promise.all(
      subgraphs.map(async (s) => ({
        name: s.name,
        url: s.url,
        typeDefs: parse(await this.fetchSdl(s.url)),
      })),
    );
    const result = composeServices(services);
    if (result.errors && result.errors.length > 0) {
      throw new Error(
        `supergraph compose failed: ${result.errors.map((e) => e.message).join('; ')}`,
      );
    }
    if (typeof result.supergraphSdl !== 'string' || result.supergraphSdl.length === 0) {
      throw new Error('supergraph compose: пустой supergraphSdl');
    }
    this.logger.debug(`composed supergraph from ${services.length} subgraphs`);
    return result.supergraphSdl;
  }

  private async fetchSdl(url: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: SDL_QUERY }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        throw new Error(`subgraph ${url} → HTTP ${resp.status}`);
      }
      const body = (await resp.json()) as { data?: { _service?: { sdl?: string } } };
      const sdl = body.data?._service?.sdl;
      if (typeof sdl !== 'string' || sdl.length === 0) {
        throw new Error(`subgraph ${url}: пустой _service.sdl — это federation-subgraph?`);
      }
      return sdl;
    } finally {
      clearTimeout(timer);
    }
  }
}
