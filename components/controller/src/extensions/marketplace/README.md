# Marketplace — расширение «Стол заказов»

Бэкенд кооперативной закупки/распределения имущества (членская модель): каталог
оферт, коллективные заказы, приёмка на склад КУ (ПВЗ), **выдача пайщику**,
возвраты, списание скоропорта, экономика КУ (членский взнос/распределение).
Ниже — быстрый контекст по самому нетривиальному потоку (выдача); внизу файла
осталась справка по дереву категорий (донорская часть Ozon).

---

## ⭐ Выдача имущества — ЕДИНЫЙ ПУТЬ (бандл-пропозал)

Главный инвариант: **до подписи пайщика в блокчейне по выдаче не происходит
ничего.** И обычные заказы, и докладку со склада оператор кладёт в ОДИН
оффчейн-бандл (PG), подписывая свою (первую) подпись акта. Связка подписей
уходит на цепь только когда пайщик у стойки контрподписывает акт. Поэтому
отмена пайщиком = отказ от бандла (оффчейн), без он-чейн отката, и нет двух
веток «уже в цепи / ещё в БД».

```
ОПЕРАТОР у стойки (IssueActOpenDialog):
  по выдаваемым заказам И докладке со склада подписывает АПП-выдачи первой
  подписью (signiss1) → marketplaceCreateStockProposal (бандл в PG).
  Заказы остаются ACCEPTED_TO_COOP; в цепи — ничего.
        │  (пайщику realtime-сигнал → гейт «подпись на месте»)
        ▼
ПАЙЩИК в OnsiteSignatureGate — одна карточка-акт, две кнопки:
  ├─ «Подписать и получить»  → marketplaceFinalizeStockIssuance:
  │     (0) контрольная сверка: контрподписанный акт байт-в-байт = выданный
  │         оператором signiss1 (защита от подмены тела «вагон алюминия»);
  │     (1) при дефиците членских — ОДНА конвертация паевого по Заявлению;
  │     (2) докладка → createStockOrder (обычный заказ уже существует);
  │     (3) по строке: openIssuance(signiss1 оператора) → finalizeIssuance(signiss2 пайщика).
  │     Заказы → RECEIVED.
  └─ «Отменить»               → marketplaceDeclineStockProposal (оффчейн).
                                 Заказы остаются ACCEPTED_TO_COOP — оператор
                                 переоткрывает выдачу и формирует акт заново.
```

**Экономика по типу строки бандла** (`order_id` в `MarketplaceStockProposalItem`
— дискриминатор): докладка (нет `order_id`) фондируется целиком с членского
(lock на stockorder, дефицит закрывает конвертация); обычный заказ (есть
`order_id`) уже профондирован с паевого на `createorder` — конвертация ему не
нужна, доплату при факт>заказ берёт сам `signiss2` на цепи и фейлится при
нехватке членских.

**`READY_TO_RECEIVE` теперь транзитный**: `signiss1` ставит его, `signiss2`
сразу читает и переводит в `RECEIVED` внутри одной finalize-связки. Отдельного
member-видимого состояния «готов к получению» НЕТ (поэтому в «Мои заказы» нет
подписи получения и нет вкладки «Готовы к выдаче»).

### Ключевые файлы выдачи

| Слой | Файл | Роль |
|---|---|---|
| Сервис-оркестратор | `application/services/marketplace-stock-proposal.service.ts` | бандл: createProposal / getAcceptSignablePayloads / **finalizeStockIssuance** / decline / cancel + контрольная сверка `assertCountersignMatchesStored` |
| Сервис выдачи | `application/services/marketplace-issuance.service.ts` | `openIssuance`/`finalizeIssuance` (signiss1/signiss2 на цепь) + генерация АПП (1105); зовутся ИЗНУТРИ бандла, не из GraphQL |
| Резолвер бандла | `application/resolvers/marketplace-stock.resolver.ts` | `marketplaceCreateStockProposal` / `marketplaceStockProposalSignablePayloads` / `marketplaceFinalizeStockIssuance` / decline / cancel |
| Резолвер выдачи | `application/resolvers/marketplace-issuance.resolver.ts` | `marketplaceIssueActChairmanSignablePayload` (signiss1-превью оператору) + `marketplaceListIssuancesByBraname` (лента оператора) |
| Домен-строка | `domain/entities/marketplace-stock-proposal.types.ts` | `MarketplaceStockProposalItem` (+ `order_id`/`order_hash`/`signiss1_act`) |
| Фронт оператора | `desktop/.../OperatorIssuance/ui/IssueActOpenDialog.vue` | сборка одного бандла (order_items + докладка), подпись signiss1 |
| Фронт пайщика | `desktop/.../OnsiteSignatureGate/` | единая карточка-акт: «Подписать и получить» / «Отменить» |

> Контракт не меняли: используются существующие `signiss1`/`signiss2`/`stockorder`/
> `convert`. Старого немедленного он-чейн-пути выдачи (`marketplaceOpenIssuance`/
> `marketplaceFinalizeIssuance`/`marketplaceListMyReadyToReceive`/orderer-payload)
> больше нет — он удалён как мёртвый после унификации.

---

## Возможности (дерево категорий — донорская часть Ozon)

### 🗂️ Дерево категорий
- Получение полного дерева категорий с иерархией
- Поиск категорий по названию
- Фильтрация по доступности
- Получение листовых категорий (где можно создавать товары)
- Статистика по категориям

### 🏷️ Типы товаров
- Получение типов товаров для категорий
- Фильтрация доступных типов
- Связь типов с категориями

### ⚙️ Атрибуты товаров
- Получение атрибутов для конкретной категории и типа
- Группировка атрибутов
- Обязательные и аспектные атрибуты
- Валидация значений атрибутов

### 📚 Словари значений
- Поиск значений в словарях
- Атрибуты со справочными значениями
- Поддержка изображений в значениях

## GraphQL API

### Запросы категорий

```graphql
# Получить дерево категорий
query GetCategoryTree {
  getMarketplaceCategoryTree(input: {
    onlyAvailable: true
    includeTypes: true
    maxDepth: 3
  }) {
    descriptionCategoryId
    categoryName
    disabled
    isLeafCategory
    children {
      descriptionCategoryId
      categoryName
      types {
        typeId
        typeName
        isAvailable
      }
    }
  }
}

# Поиск категорий
query SearchCategories {
  searchMarketplaceCategories(input: {
    searchTerm: "канцелярские"
    onlyAvailable: true
    limit: 10
  }) {
    descriptionCategoryId
    categoryName
    fullPath
  }
}

# Статистика категорий
query GetCategoryStats {
  getMarketplaceCategoryTreeStats {
    totalCategories
    rootCategories
    leafCategories
    totalTypes
    availableTypes
  }
}
```

### Запросы атрибутов

```graphql
# Получить атрибуты для категории и типа
query GetCategoryAttributes {
  getMarketplaceCategoryAttributes(input: {
    categoryId: 17029016
    typeId: 970778135
    includeDictionaryValues: true
    onlyRequired: false
  }) {
    attributeId
    name
    description
    type
    isRequired
    isAspect
    dictionary {
      dictionaryId
      name
      values {
        dictionaryValueId
        value
        info
      }
    }
  }
}

# Группированные атрибуты
query GetGroupedAttributes {
  getMarketplaceCategoryAttributesGrouped(input: {
    categoryId: 17029016
    typeId: 970778135
  }) {
    groupName
    attributesCount
    attributes {
      attributeId
      name
      isRequired
    }
  }
}

# Поиск атрибутов
query SearchAttributes {
  searchMarketplaceAttributes(input: {
    searchTerm: "бренд"
    onlyRequired: true
    limit: 5
  }) {
    attributeId
    name
    description
    isRequired
    isAspect
  }
}
```

## Архитектура

Расширение построено по чистой архитектуре с разделением на слои:

### 📋 Доменный слой (`domain/`)
- **Entities** - доменные сущности (Category, Type, Attribute, Dictionary)
- **Repositories** - интерфейсы репозиториев
- **Services** - доменные сервисы с бизнес-логикой

### 🔧 Слой приложения (`application/`)
- **DTO** - GraphQL DTO для входных и выходных данных
- **Resolvers** - GraphQL резолверы
- **Services** - сервисы приложения

### 🏗️ Инфраструктурный слой (`infrastructure/`)
- **Adapters** - адаптеры для подключения к базе данных ozon-categories

## Конфигурация

```typescript
interface IConfig {
  // Системное состояние принятия положения ЦПП советом (скрыто из формы установки).
  coopAcceptance: {
    accepted: boolean;
    document_registry_id: number;
    accepted_at: string;
    accepted_by_board_decision_id: string;
  };
  // Настройки автосписания скоропорта (видимы в форме установки).
  writeoff: {
    auto_proposal_enabled: boolean; // Автоформирование проекта списания (по умолчанию вкл.)
    post_expiry_grace_days: number; // Списывать спустя N дней после истечения срока (по умолчанию 7)
  };
}
```

В форме установки расширения показываются только пользовательские настройки
(блок `writeoff`); `coopAcceptance` — внутреннее состояние, помечено
`visible: false`. Человекочитаемые подписи полей задаются через `describeField`
в `Schema` (см. `types.ts`), как в расширении `capital`.

## Использование

После установки и активации расширения, GraphQL API становится доступен по эндпоинту `/v1/graphql`.

Примеры использования см. в секции GraphQL API выше.
