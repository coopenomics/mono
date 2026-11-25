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
  ExtensionAccessGuard,
  ExtensionFederationModule,
  ExtensionPortsModule,
  HealthController,
  loadExtensionConfig,
} from '@coopenomics/extension-sdk';
import { ChatResolver } from './chat/chat.resolver';

const cfg = loadExtensionConfig();

@Module({
  imports: [
    ExtensionFederationModule.forRoot(),
    // Порты ядра по сети. Тот же список — в манифесте пакета (coopenomics.ports).
    ExtensionPortsModule.forRoot({
      coreUrl: cfg.corePortsUrl!,
      token: cfg.corePortsToken!,
      ports: ['accessToken', 'document'],
    }),
  ],
  controllers: [HealthController],
  providers: [ChatResolver, ExtensionAccessGuard],
})
export class AppModule {}
```

```ts
// src/chat/chat.resolver.ts
import { ResolveField, Resolver, Parent, Query, UseGuards } from '@nestjs/graphql';
import { SharedCooperator, ExtensionAccessGuard } from '@coopenomics/extension-sdk';
import { ChatService } from './chat.service';

@Resolver(() => SharedCooperator)
export class ChatResolver {
  constructor(private readonly chat: ChatService) {}

  @ResolveField(() => [String])
  @UseGuards(ExtensionAccessGuard)
  async chatThreads(@Parent() cooperator: SharedCooperator): Promise<string[]> {
    return this.chat.listThreads(cooperator.username);
  }
}
```

## Порты ядра

Приложение работает в своём контейнере и обращается к ядру по сети. Порт
инжектится так же, как в расширении внутри монолита:

```ts
import { DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';

constructor(@Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort) {}
```

За токеном стоит вызов `POST /v1/internal/ports/:port/:method` ядра. Адрес
ядра и токен приложения оркестратор кладёт в окружение контейнера
(`CORE_PORTS_URL`, `CORE_PORTS_TOKEN`).

Что приложению доступно, определяет его манифест (`package.json`):

```json
"coopenomics": {
  "ports": ["accessToken", "document", "chain"],
  "chainActions": ["soviet::createagenda"]
}
```

- Незаявленный порт ядро отклоняет. Открытые порты и методы — `REMOTE_PORT_METHODS`.
- Действия цепи подписывает ядро ключом узла и только заявленные. Ключ
  кооператива приложению не передаётся; `chain.initialize` — пустое действие.
- Пайщика по токену опознаёт ядро (`ExtensionAccessGuard`, порт `accessToken`).
  Секрет ядра приложению не передаётся.
- Чтения при сбое сети повторяются один раз, действия цепи и формирование
  документа — нет. Отказ ядра — исключение `CorePortError` с его кодом.

Образец — `examples/example-app` в репозитории apps-catalog.

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
