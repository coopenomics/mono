/**
 * Политика каркаса синхронизации.
 *
 * Отделена от настроек контура (`platformSettings`) намеренно: те описывают
 * кооператив — имя, адреса, зону, — а здесь режим обработки дельт, свойство
 * стенда, а не кооператива.
 *
 * Задаёт её composition root контроллера при старте, рядом с остальными
 * предусловиями. Расширение, собранное отдельно, получит значения по умолчанию
 * — они совпадают с поведением контроллера без переменных окружения.
 */
export interface SyncPolicy {
  /**
   * Что делать с дельтой неизвестной версии контракта.
   *
   * `false` (по умолчанию) — записать предупреждение и пропустить: расхождение
   * схемы не должно останавливать синхронизацию рабочего кооператива.
   * `true` — бросить `UnsupportedContractVersionError`, парсер не подтвердит
   * дельту и она уйдёт в dead-letter. Так включают на стенде, когда нужно
   * убедиться, что расхождения схемы нет вовсе.
   */
  unsupportedVersionStrict: boolean;
}

const DEFAULTS: SyncPolicy = {
  unsupportedVersionStrict: false,
};

let policy: SyncPolicy = DEFAULTS;

/** Вызывается composition root'ом при старте. Повторный вызов перезаписывает. */
export function configureSyncPolicy(next: Partial<SyncPolicy>): void {
  policy = { ...DEFAULTS, ...next };
}

/** Текущая политика; без настройки — значения по умолчанию. */
export function syncPolicy(): SyncPolicy {
  return policy;
}
