import { ContributorStatus } from '../enums/contributor-status.enum';
import type { IContributorDatabaseData } from '../interfaces/contributor-database.interface';
import type { IContributorBlockchainData } from '../interfaces/contributor-blockchain.interface';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность участника
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные участника из таблицы contributors
 */
export class ContributorDomainEntity
  extends BaseDomainEntity<IContributorDatabaseData>
  implements IBlockchainSynchronizable, Partial<IContributorBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'contributor_hash';

  // Поля из базы данных
  public id?: number; // ID в блокчейне

  // Доменные поля (расширения)
  public status: ContributorStatus;

  // Поля для отображения информации об аккаунте
  public display_name: string; // ФИО или название организации
  public about: string; // Описание участника

  // Поля для отслеживания пути регистрации
  public program_key?: string; // Ключ выбранной программы (generation, capitalization)
  public blagorost_offer_hash?: string; // Хеш оферты Благорост (если выбран путь Благороста)
  public generator_offer_hash?: string; // Хеш оферты Генератор (если выбран путь Генератора)
  public generation_contract_hash?: string; // Хеш договора УХД
  public storage_agreement_hash?: string; // Хеш соглашения о хранении имущества
  public blagorost_agreement_hash?: string; // Хеш соглашения Благорост (может быть заполнен из оферты или из соглашения)

  // Поля из блокчейна (contributors.hpp)
  public contributor_hash: IContributorBlockchainData['contributor_hash'];

  public coopname!: IContributorBlockchainData['coopname'];
  public username!: IContributorBlockchainData['username'];
  public blockchain_status!: IContributorBlockchainData['status']; // Статус из блокчейна
  public memo!: IContributorBlockchainData['memo'];
  public is_external_contract!: IContributorBlockchainData['is_external_contract'];
  public contract!: ISignedDocumentDomainInterface;
  public appendixes!: IContributorBlockchainData['appendixes'];
  public rate_per_hour!: string;
  public hours_per_day!: number;
  public debt_amount!: IContributorBlockchainData['debt_amount'];
  public contributed_as_investor!: IContributorBlockchainData['contributed_as_investor'];
  public contributed_as_creator!: IContributorBlockchainData['contributed_as_creator'];
  public contributed_as_author!: IContributorBlockchainData['contributed_as_author'];
  public contributed_as_coordinator!: IContributorBlockchainData['contributed_as_coordinator'];
  public contributed_as_contributor!: IContributorBlockchainData['contributed_as_contributor'];
  public contributed_as_propertor!: IContributorBlockchainData['contributed_as_propertor'];
  public created_at!: IContributorBlockchainData['created_at'];

  // Поля геймификации
  public level!: IContributorBlockchainData['level'];
  public energy!: IContributorBlockchainData['energy'];
  public last_energy_update!: IContributorBlockchainData['last_energy_update'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IContributorDatabaseData, blockchainData?: IContributorBlockchainData) {
    // Вызываем конструктор базового класса без данных (инициализируем поля вручную)
    super(databaseData, ContributorStatus.PENDING);

    this.status = this.mapStatusToDomain(databaseData.status);

    // Специфичные поля для contributor
    this.contributor_hash = databaseData.contributor_hash.toLowerCase();
    this.display_name = databaseData.display_name;
    this.about = databaseData.about ?? '';

    // Поля для отслеживания пути регистрации
    this.program_key = databaseData.program_key;
    this.blagorost_offer_hash = databaseData.blagorost_offer_hash?.toLowerCase();
    this.generator_offer_hash = databaseData.generator_offer_hash?.toLowerCase();
    this.generation_contract_hash = databaseData.generation_contract_hash?.toLowerCase();
    this.storage_agreement_hash = databaseData.storage_agreement_hash?.toLowerCase();
    this.blagorost_agreement_hash = databaseData.blagorost_agreement_hash?.toLowerCase();

    this.coopname = databaseData.coopname ?? '';
    this.username = databaseData.username ?? '';

    // Данные из блокчейна
    if (blockchainData) {
      if (this.contributor_hash != blockchainData.contributor_hash.toLowerCase())
        throw new Error('Contributor hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.contributor_hash = blockchainData.contributor_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.memo = blockchainData.memo;
      this.is_external_contract = blockchainData.is_external_contract;
      this.contract = blockchainData.contract;
      this.appendixes = blockchainData.appendixes.map((el) => el.toLowerCase());
      this.rate_per_hour = blockchainData.rate_per_hour.toString();
      this.hours_per_day = Number(blockchainData.hours_per_day);
      this.debt_amount = blockchainData.debt_amount;
      this.contributed_as_investor = blockchainData.contributed_as_investor;
      this.contributed_as_creator = blockchainData.contributed_as_creator;
      this.contributed_as_author = blockchainData.contributed_as_author;
      this.contributed_as_coordinator = blockchainData.contributed_as_coordinator;
      this.contributed_as_contributor = blockchainData.contributed_as_contributor;
      this.contributed_as_propertor = blockchainData.contributed_as_propertor;
      this.created_at = blockchainData.created_at;

      // Поля геймификации
      this.level = blockchainData.level;
      this.energy = blockchainData.energy;
      this.last_energy_update = blockchainData.last_energy_update;

      // Синхронизация статуса с блокчейн данными
      this.status = this.mapStatusToDomain(blockchainData.status);
    }
  }

  /**
   * Получение номера блока последнего обновления
   */
  getBlockNum(): number | undefined {
    return this.block_num;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне (статический метод)
   */
  public static getPrimaryKey(): string {
    return ContributorDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ContributorDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ContributorDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ContributorDomainEntity.sync_key;
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из contributors.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ContributorStatus {
    switch (blockchainStatus) {
      case 'pending':
        return ContributorStatus.PENDING;
      case 'approved':
        return ContributorStatus.APPROVED;
      case 'active':
        return ContributorStatus.ACTIVE;
      case 'inactive':
        return ContributorStatus.INACTIVE;
      case 'import':
        return ContributorStatus.IMPORT;
      default:
        // По умолчанию считаем статус неопределенным

        return ContributorStatus.UNDEFINED;
    }
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IContributorBlockchainData, blockNum: number, present = true): void {
    // Сохраняем значение about, так как оно из базы данных, а не из блокчейна
    const savedAbout = this.about;

    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Восстанавливаем about из базы данных
    this.about = savedAbout;

    // Нормализация hash полей
    if (this.contributor_hash) this.contributor_hash = this.contributor_hash.toLowerCase();
  }
}
