/**
 * Дельта таблицы блокчейна — то, что прилетает из SHiP-парсера на каждое
 * изменение строки в state контракта.
 *
 * Каркас синхронизации обязан знать эту форму: с неё начинается вся цепочка
 * `delta -> mapper -> сущность -> репозиторий`. Ядро контроллера объявляло тот
 * же тип в `~/types/common` и теперь реэкспортирует его отсюда, чтобы описание
 * оставалось одно.
 */
export interface IDelta {
  chain_id: string;
  block_num: number;
  block_id: string;
  /** ISO-8601 время блока (UTC) из SHiP-трейса. parser2 отдаёт, parser1 не отдавал. */
  block_time?: string;
  present: boolean;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  value?: any;
}
