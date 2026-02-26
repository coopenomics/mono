import type { IVoteDatabaseData } from '../interfaces/vote-database.interface';
import type { IVoteBlockchainData } from '../interfaces/vote-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
/**
 * Доменная сущность голоса
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные голоса из таблицы votes
 */
export class VoteDomainEntity
  extends BaseDomainEntity<IVoteDatabaseData>
  implements IBlockchainSynchronizable, Partial<IVoteBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'id'; //id - ключ синхронизации

  // Специфичные поля для vote
  public id?: number; // ID в блокчейне

  // Поля из блокчейна (votes.hpp)
  public coopname?: IVoteBlockchainData['coopname'];
  public project_hash?: IVoteBlockchainData['project_hash'];
  public voter?: IVoteBlockchainData['voter'];
  public recipient?: IVoteBlockchainData['recipient'];
  public amount?: IVoteBlockchainData['amount'];
  public voted_at?: IVoteBlockchainData['voted_at'];

  // Дополнительные поля из связанных сущностей
  public voter_display_name?: string; // Отображаемое имя голосующего из участника
  public recipient_display_name?: string; // Отображаемое имя получателя из участника

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   * @param additionalData - дополнительные данные из связанных сущностей
   */
  constructor(
    databaseData: IVoteDatabaseData,
    blockchainData?: IVoteBlockchainData,
    additionalData: { voter_display_name?: string; recipient_display_name?: string } = {}
  ) {
    // Вызываем конструктор базового класса с данными
    super(databaseData);

    // Данные из блокчейна
    if (blockchainData) {
      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.voter = blockchainData.voter;
      this.recipient = blockchainData.recipient;
      this.amount = blockchainData.amount;
      this.voted_at = blockchainData.voted_at;
    }

    // Устанавливаем дополнительные поля
    if (additionalData) {
      this.voter_display_name = additionalData.voter_display_name;
      this.recipient_display_name = additionalData.recipient_display_name;
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
    return VoteDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return VoteDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return VoteDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return VoteDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IVoteBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);

    // Нормализация hash полей
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
  }
}
