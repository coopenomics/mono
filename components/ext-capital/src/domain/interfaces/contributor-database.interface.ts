import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных участника из базы данных
 */
export type IContributorDatabaseData = IBaseDatabaseData & {
  contributor_hash: string;
  blockchain_status?: string;
  display_name: string;
  about?: string;
  coopname: string;
  username: string;
  // Поля для отслеживания пути регистрации
  program_key: string | undefined; // Ключ выбранной программы (generation, capitalization)
  blagorost_offer_hash: string | undefined; // Хеш оферты Благорост (если выбран путь Благороста)
  generator_offer_hash: string | undefined; // Хеш оферты Генератор (если выбран путь Генератора)
  generation_contract_hash: string | undefined; // Хеш договора УХД
  storage_agreement_hash: string | undefined; // Хеш соглашения о хранении имущества
  blagorost_agreement_hash: string | undefined; // Хеш соглашения Благорост (может быть заполнен из оферты или из соглашения)
};
