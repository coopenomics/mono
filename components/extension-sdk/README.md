# @coopenomics/extension-sdk

SDK для разработки backend-расширений Apollo Federation v2 subgraph'ов экосистемы цифрового кооператива.

См. подробнее: `apps-catalog/docs/epics/E10-federation-runtime.md`.

## Зачем

Расширение в платформе цифрового кооператива — это пара артефактов:
- **frontend** (`install.js` bundle, попадает в desktop через remote-loader)
- **backend** (Nest-app, поднимается оркестратором как docker-контейнер и подключается к Apollo Gateway как subgraph)

Этот пакет задаёт **контракт backend-части**: какие модули обязательны (federation driver + JWT guard + healthcheck), как ссылаться на core-entity (Cooperator/Cooperative/Account), как читать env'ы.

## Минимальный пример

```ts
// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadExtensionConfig } from '@coopenomics/extension-sdk';
import { AppModule } from './app.module';

async function bootstrap() {
  const cfg = loadExtensionConfig();
  const app = await NestFactory.create(AppModule);
  await app.listen(cfg.subgraphPort);
}
bootstrap();
```

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import {
  ExtensionFederationModule,
  ExtensionAuthModule,
  HealthController,
  loadExtensionConfig,
} from '@coopenomics/extension-sdk';
import { ChatResolver } from './chat/chat.resolver';

const cfg = loadExtensionConfig();

@Module({
  imports: [
    ExtensionFederationModule.forRoot(),
    ExtensionAuthModule.forRoot({ secret: cfg.jwtSecret }),
  ],
  controllers: [HealthController],
  providers: [ChatResolver],
})
export class AppModule {}
```

```ts
// src/chat/chat.resolver.ts
import { ResolveField, Resolver, Parent, Query, UseGuards } from '@nestjs/graphql';
import { SharedCooperator, ExtensionJwtAuthGuard } from '@coopenomics/extension-sdk';
import { ChatService } from './chat.service';

@Resolver(() => SharedCooperator)
export class ChatResolver {
  constructor(private readonly chat: ChatService) {}

  @ResolveField(() => [String])
  @UseGuards(ExtensionJwtAuthGuard)
  async chatThreads(@Parent() cooperator: SharedCooperator): Promise<string[]> {
    return this.chat.listThreads(cooperator.username);
  }
}
```

После build'а:
- `docker build` через `templates/Dockerfile`
- `docker push registry.coopenomics.world/<scope>/<name>:<version>`
- `npm publish` install.js bundle
- on-chain `apps::regpkg` через voskhod operator
- orchestrator подхватит после approve

## ENV-переменные

| Переменная | Описание | Обязательная |
|---|---|---|
| `SUBGRAPH_PORT` | Порт subgraph'а внутри контейнера | ✓ |
| `JWT_SECRET` | Тот же что у core'а (выдаёт core, проверяет subgraph) | ✓ |
| `COOPNAME` | Account name кооператива-tenant'а | ✓ |
| `DATABASE_URL` | Postgres connection string (если расширение пишет в БД) |   |
| `CORE_GRAPHQL_URL` | Endpoint core subgraph'а (для cross-extension queries) |   |
