import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
import type { CommitData } from '../entities/commit.entity';

/**
 * Интерфейс данных коммита из базы данных
 */
export type ICommitDatabaseData = IBaseDatabaseData & {
  commit_hash: string;
  blockchain_status?: string;

  /** Обогащенные данные коммита (diff, источник и т.д.) */
  data: CommitData | null;
};
