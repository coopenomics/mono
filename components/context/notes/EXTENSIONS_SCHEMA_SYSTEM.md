# Система генерации форм из Zod-схем для расширений

## Обзор

Система автоматически генерирует формы настроек для расширений на основе Zod-схем. Это позволяет разработчикам описывать конфигурацию расширения декларативно, а интерфейс автоматически создает соответствующие поля ввода.

## Архитектура потока данных

### 1. Определение схемы (Backend - Controller)

Разработчик расширения определяет Zod-схему в модуле расширения:

```typescript
// src/extensions/powerup/powerup-extension.module.ts
export const Schema = z.object({
  dailyPackageSize: z
    .number()
    .default(5)
    .describe(
      describeField({
        label: 'Сумма автоматической ежедневной аренды',
        note: 'Пополняет автоматически каждый день',
        rules: ['val >= 5'],
        prepend: 'AXON',
      })
    ),
  thresholds: z.object({
    cpu: z.number().default(5000).describe(...),
    // ...
  }).describe(
    describeField({
      label: 'Минимальные пороги ресурсов',
      note: 'Настройки для автоматического пополнения',
    })
  ),
});
```

**Ключевые моменты:**
- Функция `describeField()` сериализует объект `DeserializedDescriptionOfExtension` в JSON-строку
- Эта строка передается в метод `.describe()` Zod-схемы
- Библиотека `zod-to-json-schema` автоматически сохраняет поле `description` в JSON Schema

### 2. Сериализация описания

```typescript
// src/extensions/powerup/powerup-extension.module.ts
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}
```

**Тип `DeserializedDescriptionOfExtension`:**
- Определен в `src/types/shared/extension.types.ts`
- Содержит метаданные для отображения поля: `label`, `note`, `visible`, `rules`, `mask`, и т.д.
- Копируется в SDK через скрипт `generate-client` в `package.json`

### 3. Преобразование Zod → JSON Schema

```typescript
// src/domain/extension/services/extension-listing-domain.service.ts
import zodToJsonSchema from 'zod-to-json-schema';

private async extractRegistryData(): Promise<Record<string, IRegistryExtension>> {
  const map: Record<string, IRegistryExtension> = {};

  for (const [key, ext] of Object.entries(AppRegistry)) {
    const { schema, ...rest } = ext;
    map[key] = {
      ...rest,
      schema: zodToJsonSchema(schema), // Zod → JSON Schema
    };
  }

  return map;
}
```

**Что происходит:**
- `zodToJsonSchema` преобразует Zod-схему в стандартный JSON Schema
- Поле `description` из Zod сохраняется как строка в JSON Schema
- Результат попадает в GraphQL через `ExtensionDTO`

### 4. Передача через GraphQL

```typescript
// src/application/appstore/dto/extension-graphql.dto.ts
@ObjectType('Extension')
export class ExtensionDTO<TConfig = any> {
  @Field(() => GraphQLJSON, { nullable: true })
  schema: any; // JSON Schema с сериализованными description
}
```

**GraphQL схема:**
```graphql
type Extension {
  schema: JSON  # JSON Schema с description как JSON-строки
}
```

### 5. Десериализация на фронтенде

```typescript
// desktop/src/entities/Extension/model/store.ts
const parseDescriptionsRecursively = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (key === 'description' && typeof value === 'string') {
        try {
          return [key, JSON.parse(value)]; // Десериализация JSON-строки
        } catch (error) {
          return [key, value];
        }
      } else if (typeof value === 'object') {
        return [key, parseDescriptionsRecursively(value)]; // Рекурсивная обработка
      } else {
        return [key, value];
      }
    })
  );
};
```

**Что происходит:**
- При загрузке расширений из GraphQL, все поля `description` (которые являются JSON-строками) парсятся обратно в объекты
- Рекурсивная обработка позволяет десериализовать вложенные объекты

### 6. Рендеринг формы

```vue
<!-- desktop/src/shared/ui/ZodForm/ZodForm.vue -->
<template>
  <div class="settings-form">
    <div
      v-for="item in visibleProperties"
      :key="item.propertyName"
      class="setting-item"
    >
      <div class="setting-header">
        <div class="setting-title">
          {{ getLabel(item.property, item.propertyName) }}
        </div>
        <div class="setting-hint" v-if="getHint(item.property)">
          {{ getHint(item.property) }}
        </div>
      </div>

      <component
        :is="getComponentType(item.property)"
        v-bind="getComponentProps(item.property, item.propertyName)"
      />
    </div>
  </div>
</template>
```

**Логика компонента:**
- `getLabel()` извлекает `label` из `property.description` или использует имя свойства
- `getHint()` извлекает `note` из `property.description`
- Для объектов типа `object` используется рекурсивный вызов `DynamicForm` (самого себя)
- Тип компонента определяется по типу свойства: `string` → `QInput`, `number` → `QInput`, `boolean` → `QCheckbox`, `object` → `DynamicForm`

## Типы данных

### Backend (Controller)

```typescript
// src/types/shared/extension.types.ts
export interface DeserializedDescriptionOfExtension {
  label: string;           // Название поля (обязательное)
  note?: string;           // Подсказка/описание
  visible?: boolean;       // Видимость (по умолчанию true)
  rules?: string[];        // Правила валидации ['val >= 5']
  mask?: string;           // Маска ввода
  fillMask?: boolean;      // Автозаполнение маски
  minLength?: number;      // Минимальная длина
  maxLength?: number;      // Максимальная длина
  maxRows?: number;        // Количество строк для textarea
  append?: string;         // Текст после значения
  prepend?: string;        // Текст перед значением
}
```

### Frontend (Desktop)

```typescript
// desktop/src/entities/Extension/model/types.ts
export type ISchemaProperty = {
  type?: ISchemaType;
  description?: Types.Controller.DeserializedDescriptionOfExtension;
  default?: any;
  properties?: ISchemaProperty;  // Для вложенных объектов
  // ...
};
```

**Связь типов:**
- Типы из `controller/src/types/shared/` копируются в SDK через скрипт `generate-client`
- Frontend использует типы из SDK: `Types.Controller.DeserializedDescriptionOfExtension`

## Поддержка вложенных объектов

### Проблема

Для вложенных объектов (например, `thresholds: { cpu, net, ram }`) не было возможности задать заголовок и описание группы полей.

### Решение

1. **Добавление описания для объекта в Zod-схеме:**

```typescript
thresholds: z.object({
  cpu: z.number().default(5000).describe(...),
  net: z.number().default(1024).describe(...),
  ram: z.number().default(10240).describe(...),
}).describe(
  describeField({
    label: 'Минимальные пороги ресурсов',
    note: 'Настройки для автоматического пополнения при достижении порогов',
  })
)
```

2. **Обновление ZodForm для отображения описания объектов:**

Компонент `ZodForm` уже поддерживает `description` для объектов через функции `getLabel()` и `getHint()`, которые используются в шаблоне для отображения заголовка и подсказки группы.

## Примеры использования

### Простое поле

```typescript
dailyPackageSize: z
  .number()
  .default(5)
  .describe(
    describeField({
      label: 'Ежедневная сумма',
      note: 'Автоматическое пополнение каждый день',
      rules: ['val >= 5'],
      prepend: 'AXON',
    })
  )
```

### Скрытое поле

```typescript
lastDailyReplenishmentDate: z
  .string()
  .default('')
  .describe(
    describeField({
      label: 'Дата последнего пополнения',
      visible: false,  // Поле скрыто в форме
    })
  )
```

### Вложенный объект

```typescript
thresholds: z.object({
  cpu: z.number().default(5000).describe(...),
  net: z.number().default(1024).describe(...),
  ram: z.number().default(10240).describe(...),
}).describe(
  describeField({
    label: 'Пороги ресурсов',
    note: 'Минимальные значения для автоматического пополнения',
  })
)
```

### Поле с валидацией

```typescript
topUpAmount: z
  .number()
  .default(5)
  .describe(
    describeField({
      label: 'Сумма экстренного пополнения',
      rules: ['val > 0'],  // Валидация на фронтенде
      prepend: 'AXON',
    })
  )
```

## Поток данных (схема)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Backend: Определение Zod-схемы                             │
│    Schema = z.object({...}).describe(describeField({...}))   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend: Сериализация description                         │
│    describeField() → JSON.stringify()                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend: Zod → JSON Schema                                │
│    zodToJsonSchema(schema)                                   │
│    description сохраняется как JSON-строка                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. GraphQL: Передача через API                               │
│    ExtensionDTO.schema (JSON Schema)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend: Десериализация                                  │
│    parseDescriptionsRecursively()                            │
│    JSON.parse(description) → объект                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Frontend: Рендеринг формы                                 │
│    ZodForm.vue использует description.label и description.note│
└─────────────────────────────────────────────────────────────┘
```

## Важные замечания

1. **Типизация:** Zod-схема автоматически создает тип TypeScript через `z.infer<typeof Schema>`, но этот тип не передается на фронтенд. На фронтенде используется JSON Schema, который не имеет строгой типизации.

2. **Валидация:** Правила валидации (`rules`) выполняются на фронтенде через динамическое создание функций из строковых выражений. Backend валидация происходит через `schema.safeParse()`.

3. **Рекурсивность:** Система поддерживает вложенные объекты любой глубины через рекурсивный вызов `DynamicForm` и рекурсивную десериализацию `parseDescriptionsRecursively`.

4. **Совместимость:** JSON Schema является стандартом, что позволяет использовать схему в других системах или инструментах.

## Связанные файлы

- **Backend:**
  - `src/extensions/*/powerup-extension.module.ts` - определение схем
  - `src/types/shared/extension.types.ts` - тип описания
  - `src/domain/extension/services/extension-listing-domain.service.ts` - преобразование Zod → JSON Schema
  - `src/application/appstore/dto/extension-graphql.dto.ts` - GraphQL DTO

- **Frontend:**
  - `desktop/src/shared/ui/ZodForm/ZodForm.vue` - компонент формы
  - `desktop/src/entities/Extension/model/store.ts` - десериализация
  - `desktop/src/entities/Extension/model/types.ts` - типы схемы

- **SDK:**
  - `sdk/src/types/controller/extension.types.ts` - копия типов из controller

---

# Канон онбординга расширения (гейтинг столов + редирект при включении)

Отдельный, но связанный механизм: некоторые расширения требуют **подключения
на уровне кооператива** (например, совет принимает ЦПП) ПРЕЖДЕ чем их рабочие
столы станут доступны пайщикам. Канон делает это переиспользуемо и **опционально**
— расширения, которые не объявляют поля ниже, работают как раньше (все столы
видны сразу после включения).

## Контракт реестра (`extensions.registry.ts`)

`IRegistryExtension` имеет три опциональных поля:

```typescript
onboarding_route?: string;                  // имя роута страницы подключения
onboarding_desktop?: string;                // единственный стол, видимый до онбординга
isOnboarded?: (config: any) => boolean;     // готовность: ЦПП принят и т.п.
```

Пример для `market`:

```typescript
onboarding_route: 'marketplace-onboarding-coop-cpp',
onboarding_desktop: 'market-admin',
isOnboarded: (config) => Boolean(config?.coopAcceptance?.accepted),
```

## Как работает (две согласованные половины)

1. **Бэкенд — скрытие столов из переключателя.**
   `DesktopDomainInteractor.getDesktop()` для каждого расширения вычисляет
   `isOnboarded(app.config)`. Пока `false` и задан `onboarding_desktop`, в
   список workspaces попадает ТОЛЬКО `onboarding_desktop` — остальные столы
   расширения отсутствуют в `getDesktop`, поэтому не появляются в
   переключателе столов (он строится из `currentDesktop.workspaces`, см.
   `desktop/src/entities/Desktop/model/store.ts` → `workspaceMenus`).
   Это runtime-фильтрация данных, схема GraphQL не меняется (кодоген не нужен).

2. **Фронтенд — ограничение содержимого стола + роль.**
   `extensions/<name>/install.ts` зеркалит решение бэкенда: если в десктопе
   с бэкенда присутствует `onboarding_desktop`, но нет «обычного» стола —
   возвращает ТОЛЬКО онбординг-стол с единственным дочерним роутом
   (`onboarding_route`) и `meta.roles` суженным до той роли, что может
   проводить онбординг (для market — `['chairman']`). Так до принятия ЦПП
   никто, кроме председателя, не видит ни столов, ни страниц; председатель
   видит один стол и одну страницу — «Подключение ЦПП».

   Видимость стола по ролям определяется `meta.roles` РОДИТЕЛЬСКОГО роута
   стола (`workspaceMenus` берёт meta из `routes[0]`). Если у стола нет
   привязанных роутов — meta по умолчанию `roles: []` (виден всем), поэтому
   гейтить только бэкендом недостаточно: фронт обязан вернуть роут с нужной
   ролью.

3. **Редирект при включении (`InstallButton.vue` / `EnableButton.vue`).**
   `loadExtensionRoutes()` возвращает `IWorkspaceConfig[]`; кнопки редиректят
   на `configs[0].defaultRoute`. У онбординг-стола `defaultRoute` = страница
   подключения, поэтому администратора после включения сразу ведёт на ЦПП,
   а не на общий каталог приложений.

## Жизненный цикл / ограничения

- `install.ts` и `getDesktop` пере-вычисляются при **старте приложения**
  (`useInitAppProcess` → `loadDesktop` → `useInitExtensionsProcess`) и при
  **включении** расширения. Они НЕ реактивны на изменение состояния онбординга
  в рантайме: после того как совет принял ЦПП и `coopAcceptance.accepted`
  стал `true`, столы появятся после перезагрузки страницы (или повторного
  входа). Для MVP это приемлемо.
- Источник **безопасности** — backend-резолверы расширения (роли/доступ);
  гейтинг столов — UX-слой поверх них, не замена авторизации.
- Опциональность: механизм включается только наличием полей в реестре, что
  не ломает существующие расширения (capital и т.д.). Их переведут позже.

## Связанные файлы (онбординг-канон)

- **Backend:**
  - `src/extensions/extensions.registry.ts` — поля `onboarding_route` /
    `onboarding_desktop` / `isOnboarded`.
  - `src/application/desktop/interactors/desktop.interactor.ts` — фильтрация
    столов в `getDesktop`.
- **Frontend:**
  - `desktop/extensions/<name>/install.ts` — гейт-ветка (для market — Стол
    администратора с одной страницей подключения, chairman-only).
  - `desktop/src/processes/init-installed-extensions/index.ts` —
    `loadExtensionRoutes` возвращает конфиги.
  - `desktop/src/features/Extension/{InstallExtension,EnableExtension}/ui/*Button.vue`
    — редирект на `defaultRoute` первого стола.

