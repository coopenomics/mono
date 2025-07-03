# Notifications Library - Типизированные Workflow для Novu

Библиотека для создания типизированных workflow уведомлений с использованием Zod схем и паттерна Builder.

## Особенности

- 🔒 **Типобезопасность** - Полная типизация payload с Zod
- 🏗️ **Builder Pattern** - Удобное создание workflow
- 📝 **Декларативный API** - Простое описание шагов уведомлений
- 🔧 **Расширяемость** - Легкое добавление новых типов workflow
- ⚡ **Валидация** - Автоматическая валидация данных

## Установка

```bash
cd components/notifications
pnpm install
```

## Быстрый старт

### 1. Создание нового workflow

```typescript
import { z } from 'zod';
import { WorkflowBuilder, createEmailStep, createInAppStep } from '@coopenomics/notifications';

// Определяем схему данных
const myPayloadSchema = z.object({
  userName: z.string(),
  userEmail: z.string().email(),
  orderTotal: z.number(),
});

type MyPayload = z.infer<typeof myPayloadSchema>;

// Создаем workflow
export const orderConfirmationWorkflow = WorkflowBuilder
  .create<MyPayload>()
  .name('Order Confirmation')
  .workflowId('order-confirmation')
  .description('Подтверждение заказа')
  .payloadSchema(myPayloadSchema)
  .addSteps([
    createEmailStep(
      'order-email',
      'Заказ подтвержден - {{payload.userName}}',
      'Здравствуйте, {{payload.userName}}! Ваш заказ на сумму {{payload.orderTotal}} подтвержден.'
    ),
    createInAppStep(
      'order-notification',
      'Заказ обработан',
      'Заказ успешно обработан и скоро будет отправлен.'
    ),
  ])
  .build();
```

### 2. Регистрация workflow

Добавьте ваш workflow в `src/workflows/index.ts`:

```typescript
import { orderConfirmationWorkflow } from './order-confirmation';

export const allWorkflows: WorkflowDefinition[] = [
  welcomeWorkflow,
  orderConfirmationWorkflow, // ← добавляем новый workflow
];
```

### 3. Использование в коде

```typescript
import { orderConfirmationWorkflow } from '@coopenomics/notifications';

// Валидация данных
const payload = orderConfirmationWorkflow.payloadZodSchema.parse({
  userName: 'Иван Иванов',
  userEmail: 'ivan@example.com',
  orderTotal: 1500,
});

// Данные для отправки в Novu
const novuData = orderConfirmationWorkflow.payloadSchema;
```

## Структура проекта

```
src/
├── types/           # Базовые типы и интерфейсы
├── base/            # Базовые утилиты и настройки
│   ├── defaults.ts  # Настройки по умолчанию
│   └── workflow-builder.ts # Builder для создания workflow
└── workflows/       # Папки с workflow
    ├── welcome/     # Приветственные уведомления
    ├── order/       # Уведомления о заказах
    └── index.ts     # Экспорт всех workflow
```

## API Reference

### WorkflowBuilder

Основной класс для создания workflow:

```typescript
const workflow = WorkflowBuilder
  .create<PayloadType>()
  .name('Workflow Name')                    // Название workflow
  .workflowId('unique-workflow-id')         // Уникальный ID
  .description('Описание workflow')         // Описание (опционально)
  .payloadSchema(zodSchema)                 // Zod схема для валидации
  .addStep(step)                           // Добавить шаг
  .addSteps([step1, step2])                // Добавить несколько шагов
  .origin('external')                      // Источник (опционально)
  .build();                                // Собрать workflow
```

### Вспомогательные функции

```typescript
// Email уведомление
createEmailStep(name, subject, body)

// In-app уведомление
createInAppStep(name, subject, body, avatar?)

// Push уведомление
createPushStep(name, title, body)

// SMS уведомление
createSmsStep(name, body)
```

## Типы workflow

### Email
- `subject` - Тема письма
- `body` - HTML содержимое
- `editorType` - 'html' | 'text'

### In-App
- `subject` - Заголовок уведомления
- `body` - Текст уведомления
- `avatar` - URL аватара (опционально)

### Push
- `subject` - Заголовок push-уведомления
- `body` - Текст push-уведомления

### SMS
- `body` - Текст SMS

## Шаблонизация

Используйте Handlebars синтаксис для динамических данных:

```typescript
// Простая подстановка
"Привет, {{payload.userName}}!"

// Условные блоки
"{{#payload.age}}Ваш возраст: {{payload.age}}{{/payload.age}}"

// Вложенные объекты
"{{payload.order.total}} руб."
```

## Сборка

```bash
pnpm build
```

Результат сборки будет в папке `dist/`.
