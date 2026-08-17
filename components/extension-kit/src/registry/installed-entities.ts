/**
 * Состав таблиц установленных расширений — то, что контроллер обязан отдать
 * TypeORM при подключении к базе.
 *
 * Каждое расширение объявляет свои сущности в записи реестра
 * (`IRegistryExtension.entities`), composition root складывает их сюда одним
 * вызовом, а подключение к базе читает готовый список. Прежний способ — глоб
 * `src/extensions/ ** /entities/*entity.ts` — привязывал расширение к его месту
 * на диске и не нашёл бы ни одной таблицы у расширения, установленного пакетом.
 *
 * Список задаётся один раз, до инициализации подключения. Повторный вызов —
 * ошибка: он означал бы, что состав таблиц меняется на ходу, а TypeORM после
 * инициализации новые сущности уже не примет.
 */
export type ExtensionEntityClass = new (...args: any[]) => any;

let entities: ReadonlyArray<ExtensionEntityClass> | undefined;

/** Объявить состав таблиц установленных расширений. Вызывает composition root. */
export function registerExtensionEntities(list: ReadonlyArray<ExtensionEntityClass>): void {
  if (entities) {
    throw new Error(
      'Состав таблиц расширений уже объявлен: registerExtensionEntities() вызывается один раз при старте'
    );
  }
  entities = [...list];
}

/**
 * Прочитать состав таблиц расширений.
 *
 * До объявления возвращает пустой список, а не бросает: подключение к базе
 * поднимается и в контурах без единого расширения (миграции, генератор схемы).
 */
export function extensionEntities(): ReadonlyArray<ExtensionEntityClass> {
  return entities ?? [];
}

/** Сбросить состав. Только для тестов, которые поднимают граф модулей заново. */
export function resetExtensionEntities(): void {
  entities = undefined;
}
