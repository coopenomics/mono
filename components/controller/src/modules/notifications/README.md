# Модуль Notifications

Этот модуль предоставляет прокси-функциональность для работы с NOVU через собственный бэкенд с контролем аутентификации.

## Функциональность

- **HTTP Прокси**: Проксирует все HTTP запросы к NOVU API с проверкой аутентификации
- **WebSocket Прокси**: Проксирует WebSocket соединения к NOVU с проверкой аутентификации
- **Контроль доступа**: Проверяет что пользователь может получать только свои уведомления

## Компоненты

### NotificationsController

- Обрабатывает HTTP запросы к `/notifications/*`
- Проверяет JWT токен пользователя
- Валидирует subscriberId (формат: `{coopname}-{username}`)
- Проксирует запросы к NOVU API

### NotificationsGateway

- Обрабатывает WebSocket соединения на `/notifications`
- Проверяет JWT токен в handshake
- Создает прокси-соединение к NOVU WebSocket
- Перенаправляет события между клиентом и NOVU

### NotificationsService

- Валидирует права доступа пользователя
- Проверяет соответствие subscriberId текущему пользователю
- Извлекает subscriberId из различных источников (headers, query params)

## Настройка

Необходимые переменные окружения:

```env
NOVU_APP_ID=your-novu-app-id
NOVU_BACKEND_URL=https://api.novu.co
NOVU_SOCKET_URL=https://ws.novu.co
NOVU_API_KEY=your-novu-api-key
```

## Использование на фронтенде

```javascript
// Подключение через наш бэкенд
const novu = new NovuUI({
  options: {
    applicationIdentifier: env.NOVU_APP_ID,
    subscriberId: `${coopname}-${username}`,
    backendUrl: `${env.BACKEND_URL}/notifications`,
    socketUrl: `${env.BACKEND_URL}/notifications`,
  },
});
```

## Безопасность

- Все запросы проходят через JWT аутентификацию
- SubscriberId проверяется на соответствие формату `{coopname}-{username}`
- Пользователь может получать только свои уведомления
- API ключ NOVU не передается на фронтенд
