/**
 * Метаданные документа: к какому реестру относится, кем и для кого сформирован.
 *
 * Переехал из контроллера вместе с контрактом подписанного документа:
 * зависимостей нет, а расширению путь `~/domain/**` недоступен.
 */
// Определение базового интерфейса для мета-информации
export interface IMetaDocument {
  title: string;
  registry_id: number;
  lang: string;
  generator: string;
  version: string;
  coopname: string;
  username: string;
  created_at: string;
  block_num: number;
  timezone: string;
  links: string[];
}
