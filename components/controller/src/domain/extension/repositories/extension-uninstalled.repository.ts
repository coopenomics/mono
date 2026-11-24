import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';

/**
 * Удалённые расширения — записи `extensions` с отметкой `uninstalled_at`.
 *
 * «Удалить» не стирает запись (решение владельца 24.11.2026): в `config`
 * кроме настроек председателя лежат отметки онбординга (решения совета),
 * учёт собраний и служебные даты расширений. Для всех остальных читателей —
 * хранилище `EXTENSION_REPOSITORY` из каркаса — удалённой записи нет, и
 * контракт каркаса не меняется. Этот порт нужен ровно трём местам ядра:
 *
 * - доустановка расширений по умолчанию при старте не возвращает удалённое;
 * - шаг установки показывает прежние настройки удалённого расширения;
 * - секреты, пришедшие с формы маркером «задано», берутся из прежних настроек.
 *
 * Повторную установку (снятие отметки с сохранением `config`) выполняет
 * `create` основного хранилища.
 */
export interface ExtensionUninstalledRepository<TConfig = any> {
  /** Запись удалённого расширения или null, если его не удаляли (или оно установлено) */
  findUninstalledByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null>;
  /** Все удалённые расширения — одним запросом для каталога */
  findUninstalled(): Promise<ExtensionDomainEntity<TConfig>[]>;
}

export const EXTENSION_UNINSTALLED_REPOSITORY = Symbol('ExtensionUninstalledRepository');
