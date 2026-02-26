/**
 * Настройка копирования голоса.
 * Член совета указывает, чей голос он хочет автоматически копировать.
 */
export interface VoteCopySettingEntity {
  id: string;
  coopname: string;
  /** Кто копирует (член совета) */
  copier_username: string;
  /** Чей голос копируется (другой член совета) */
  source_username: string;
  /** Типы решений для копирования (пусто = все) */
  decision_types: string[];
  /** Активна ли настройка */
  is_active: boolean;
  /** Публичный ключ copyvote разрешения (из vault) */
  copyvote_public_key?: string;
  created_at: Date;
  updated_at: Date;
}
