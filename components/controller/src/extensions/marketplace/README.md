# Marketplace - Расширение маркетплейса

Расширение для работы с категориями товаров и атрибутами маркетплейса. Предоставляет GraphQL API для управления деревом категорий и типов товаров на основе данных Ozon API.

## Возможности

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
