/**
 * Стандартные действия CASL
 */
export enum Action {
  Manage = 'manage',   // Полный доступ
  Read = 'read',       // Чтение
  Create = 'create',   // Создание
  Update = 'update',   // Обновление
  Delete = 'delete',   // Удаление
  Execute = 'execute', // Выполнение действий (approve, decline, etc.)
  Share = 'share',     // Поделиться ссылкой
}
