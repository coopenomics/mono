/**
 * Доменный интерфейс для дельты таблицы блокчейна
 */
export interface DeltaDomainInterface {
  id: string;
  chain_id: string;
  block_num: number;
  block_id: string;
  /** Время блока, строка ISO в UTC. Необязательно: старый парсер его не отдавал. */
  block_time?: string;
  present: boolean;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  value?: any;
  repeat?: boolean;
  created_at: Date;
}
