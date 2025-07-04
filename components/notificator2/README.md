# Notificator2 - Web Push Notification Service

Сервис для управления web-push уведомлениями с интеграцией NOVU. Предоставляет полный функционал для регистрации push подписок, отправки уведомлений и интеграции с NOVU workflows.

## Возможности

- 🔐 **VAPID ключи**: Автоматическая генерация и управление VAPID ключами
- 📱 **Push подписки**: Регистрация, управление и автоматическая очистка подписок
- 🔗 **Интеграция NOVU**: Полная интеграция с NOVU workflows и webhooks
- 📊 **Статистика**: Мониторинг активности подписок
- 🗂️ **База данных**: Хранение подписок в PostgreSQL
- ⏰ **Автоматизация**: Cron jobs для очистки и статистики

## Установка и настройка

### 1. Переменные окружения

Создайте файл `.env` на основе `.env.example`:

```env
# Порт приложения
PORT=3000

# Настройки CORS
CORS_ORIGIN=*

# NOVU настройки
NOVU_API_KEY=your_novu_api_key_here
NOVU_API_URL=https://api.novu.co

# VAPID ключи для web-push (генерируются автоматически при первом запуске)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@coopenomics.io

# База данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=notificator
DB_SYNCHRONIZE=true
DB_LOGGING=false
DB_SSL=false

# Окружение
NODE_ENV=development
```

### 2. База данных

Убедитесь, что PostgreSQL запущен и создайте базу данных:

```sql
CREATE DATABASE notificator;
```

### 3. Запуск сервиса

```bash
# Установка зависимостей
pnpm install

# Развертывание (production)
pnpm start:prod

# Разработка
pnpm start:dev
```

## API Endpoints

### Web Push API

#### Получить VAPID публичный ключ
```
GET /api/push/vapid-public-key
```

**Ответ:**
```json
{
  "publicKey": "BKr7x...",
  "applicationServerKey": "BKr7x..."
}
```

#### Подписаться на push уведомления
```
POST /api/push/subscribe
```

**Тело запроса:**
```json
{
  "userId": "user123",
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BKr7x...",
      "auth": "abc123..."
    }
  }
}
```

#### Отписаться от push уведомлений
```
DELETE /api/push/unsubscribe
```

**Тело запроса:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

#### Отправить push уведомление
```
POST /api/push/send
```

**Тело запроса:**
```json
{
  "userId": "user123",
  "title": "Заголовок уведомления",
  "body": "Текст уведомления",
  "icon": "/icons/notification.png",
  "badge": "/icons/badge.png",
  "image": "/images/notification-image.jpg",
  "url": "/dashboard",
  "tag": "notification-tag",
  "requireInteraction": false,
  "silent": false,
  "actions": [
    {
      "action": "view",
      "title": "Открыть"
    },
    {
      "action": "dismiss",
      "title": "Закрыть"
    }
  ],
  "data": {
    "customField": "value"
  }
}
```

#### Получить статистику подписок
```
GET /api/push/stats
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "active": 120,
    "inactive": 30,
    "uniqueUsers": 85
  }
}
```

### NOVU Integration API

#### Webhook для обработки NOVU событий
```
POST /api/novu/webhook/push
```

#### Создать workflow с web-push поддержкой
```
POST /api/novu/workflow/create
```

**Тело запроса:**
```json
{
  "workflowId": "user-notification",
  "workflowName": "Уведомления пользователя"
}
```

#### Тест интеграции
```
POST /api/novu/test
```

**Тело запроса:**
```json
{
  "userId": "user123",
  "workflowId": "test-workflow"
}
```

## Интеграция с фронтендом

### Регистрация Service Worker

```javascript
// public/sw.js
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge.png',
    tag: 'notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'Открыть',
        icon: '/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Закрыть',
        icon: '/icons/close.png'
      }
    ]
  };

  try {
    const payload = JSON.parse(event.data.text());
    options.body = payload.body;
    options.icon = payload.icon || options.icon;
    options.badge = payload.badge || options.badge;
    options.tag = payload.tag || options.tag;
    options.requireInteraction = payload.requireInteraction || options.requireInteraction;
    options.actions = payload.actions || options.actions;
    options.data = payload.data;
  } catch (e) {
    // Используем дефолтные настройки
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Уведомление', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
```

### Подписка на уведомления

```javascript
// Регистрация и подписка
async function subscribeToPush(userId) {
  try {
    // Регистрируем Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // Получаем VAPID ключ
    const response = await fetch('/api/push/vapid-public-key');
    const { publicKey } = await response.json();
    
    // Подписываемся
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey
    });
    
    // Отправляем подписку на сервер
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        subscription: subscription
      })
    });
    
    console.log('Подписка на push уведомления успешна');
  } catch (error) {
    console.error('Ошибка подписки:', error);
  }
}
```

## Интеграция с NOVU

### 1. Настройка webhook в NOVU

В панели NOVU добавьте webhook endpoint:
- URL: `https://your-domain.com/api/novu/webhook/push`
- События: `workflow.step.push.sent`

### 2. Создание workflow с push поддержкой

```javascript
// Создание workflow через API
const workflow = await fetch('/api/novu/workflow/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    workflowId: 'user-notifications',
    workflowName: 'Уведомления пользователей'
  })
});
```

### 3. Триггер workflow

```javascript
// Через NOVU SDK
import { Novu } from '@novu/node';

const novu = new Novu(process.env.NOVU_API_KEY);

await novu.trigger('user-notifications', {
  to: {
    subscriberId: 'user123',
    email: 'user@example.com'
  },
  payload: {
    title: 'Новое сообщение',
    body: 'У вас есть новое сообщение в системе',
    icon: '/icons/message.png',
    url: '/messages'
  }
});
```

## Тестирование

### CLI для тестирования

Сервис включает в себя удобный CLI для тестирования всех функций:

```bash
# Интерактивный режим (по умолчанию)
pnpm test:push

# Проверить health check
pnpm test:push:health

# Показать справку
pnpm test:push:help

# Полное тестирование (нужен user ID)
pnpm test:push:full -- --user-id user123

# Интерактивный режим с verbose выводом
pnpm test:push -- --verbose interactive
```

#### Доступные команды CLI:

- `health` - Проверить доступность API
- `vapid` - Получить VAPID публичный ключ
- `subscribe -u <userId>` - Создать тестовую подписку
- `notify -u <userId>` - Отправить тестовое уведомление
- `stats` - Получить статистику подписок
- `novu -u <userId>` - Тестировать NOVU webhook
- `full -u <userId>` - Полное тестирование всех функций
- `interactive` - Интерактивный режим

#### Опции:

- `-a, --api-base <url>` - База URL API (по умолчанию: http://localhost:3000/api)
- `-v, --verbose` - Подробный вывод запросов и ответов
- `-u, --user-id <id>` - ID пользователя для тестирования

### Примеры использования

```bash
# Тестирование с другим API endpoint
pnpm test:push -- --api-base https://my-api.com/api health

# Полное тестирование с verbose выводом
pnpm test:push -- --verbose --user-id test-user full

# Интерактивный режим с кастомными настройками
pnpm test:push -- --api-base http://localhost:4000/api --verbose interactive
```

## Мониторинг и обслуживание

### Автоматические задачи

- **Очистка неактивных подписок**: Каждый день в 2:00 AM
- **Еженедельная статистика**: Каждое воскресенье в 12:00 PM

### Ручная очистка

```bash
# Очистить подписки старше 30 дней
curl -X DELETE "http://localhost:3000/api/push/cleanup?days=30"

# Или через CLI
pnpm test:push -- stats
```

### Логирование

Сервис использует встроенную систему логирования NestJS. Все операции логируются с соответствующими уровнями:

- `LOG`: Обычные операции
- `WARN`: Предупреждения (отсутствующие подписки, etc.)
- `ERROR`: Ошибки отправки, проблемы с БД

## Архитектура

```
┌─────────────────────┐    ┌─────────────────────┐
│   Frontend App      │    │      NOVU           │
│   (Service Worker)  │    │   (Workflows)       │
└─────────┬───────────┘    └─────────┬───────────┘
          │                          │
          │ Push Subscription        │ Webhooks
          │                          │
          ▼                          ▼
┌─────────────────────────────────────────────────┐
│           Notificator2 Service                  │
├─────────────────────────────────────────────────┤
│  • WebPushService (VAPID, Subscriptions)        │
│  • NovuWebPushService (Integration)             │
│  • CleanupService (Maintenance)                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│              PostgreSQL                         │
│        (Push Subscriptions)                     │
└─────────────────────────────────────────────────┘
```

## Безопасность

- ✅ VAPID ключи для аутентификации
- ✅ Валидация всех входящих данных
- ✅ Автоматическая деактивация недействительных подписок
- ✅ CORS настройки
- ✅ Webhook подпись валидация (рекомендуется для production)

## Troubleshooting

### VAPID ключи не генерируются
Проверьте, что в переменных окружения нет пустых `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY`. При первом запуске они должны быть пустыми или отсутствовать.

### Push уведомления не доходят
1. Проверьте, что Service Worker зарегистрирован
2. Убедитесь, что пользователь дал разрешение на уведомления
3. Проверьте активность подписки через `/api/push/subscriptions/:userId`

### Ошибки интеграции с NOVU
1. Проверьте правильность `NOVU_API_KEY`
2. Убедитесь, что webhook endpoint доступен из интернета
3. Проверьте логи сервиса для детальной информации об ошибках

## Лицензия

MIT
