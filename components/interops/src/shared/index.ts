/**
 * Общие утилитные типы для расширений
 */

export interface IBaseDatabaseData {
  id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IBlockchainSyncEntity {
  scope: string;
  primary_key: string;
}

export interface IEventPayload {
  event: string;
  data: any;
  timestamp?: Date;
}
