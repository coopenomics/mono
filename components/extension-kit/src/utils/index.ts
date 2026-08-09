/**
 * Общие утилиты, которыми пользуются и расширения, и ядро.
 *
 * Переехали из `~/shared/utils` контроллера: этого пути за пределами монолита
 * нет. Копии в ядре не осталось — ядро импортирует их отсюда наравне с
 * расширениями, иначе две реализации со временем разойдутся.
 *
 * Те, что раньше читали `~/config/config`, теперь берут значения из
 * `platformSettings()`. Через этот канал проходит только несекретное:
 * символы токенов, точность, часовая зона, тайминги узла.
 */
export * from './asset.utils';
export * from './amount-formatter.utils';
export * from './constants';
export * from './payments';
export * from './quantity.utils';
export * from './date-utils';
export * from './post-transact-chain-read-delay';
export * from './transact-block-num';
