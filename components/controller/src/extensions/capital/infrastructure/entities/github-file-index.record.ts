
/**
 * TypeORM сущность для индекса файлов GitHub
 * Хранит маппинг между сущностями БД и файлами в GitHub репозитории
 */
export const EntityName = 'capital_github_file_indexes';

export class GitHubFileIndexRecord {
  id!: string;

  coopname!: string;

  entity_type!: 'project' | 'issue' | 'story' | 'result' | 'room_message_day' | 'call_transcription';

  entity_hash!: string;

  file_path!: string;

  github_sha?: string;

  created_at!: Date;

  last_synced_at!: Date;
}
