import { Inject, Injectable } from '@nestjs/common';
import type {
  IUserDataPort,
  InnerUserDataDraft,
  InnerUserDataFilters,
  InnerUserDataRecord,
} from '@coopenomics/innercoop';
import { UDATA_REPOSITORY, type UdataRepository } from '~/domain/common/repositories/udata.repository';
import type { Cooperative } from 'cooptypes';

/**
 * Реализация `IUserDataPort` поверх хранилища пользовательских данных ядра.
 *
 * Ключ в контракте — строка: перечень ключей задаёт `cooptypes`, от которого
 * контракт не зависит. Здесь строка попадает в репозиторий как есть — он и
 * раньше принимал произвольный ключ наравне с перечнем.
 */
@Injectable()
export class UserDataInnercoopAdapter implements IUserDataPort {
  constructor(
    @Inject(UDATA_REPOSITORY)
    private readonly udataRepository: UdataRepository
  ) {}

  async save(record: InnerUserDataDraft): Promise<void> {
    return this.udataRepository.save({ ...record, key: this.toKey(record.key) });
  }

  async get(
    coopname: string,
    username: string,
    key: string,
    filters?: InnerUserDataFilters
  ): Promise<InnerUserDataRecord | null> {
    return this.udataRepository.get(coopname, username, this.toKey(key), filters);
  }

  async getHistory(coopname: string, username: string, key: string): Promise<InnerUserDataRecord[]> {
    return this.udataRepository.getHistory(coopname, username, this.toKey(key));
  }

  async getAll(coopname: string, username?: string): Promise<InnerUserDataRecord[]> {
    return this.udataRepository.getAll(coopname, username);
  }

  async remove(coopname: string, username: string, key: string): Promise<void> {
    return this.udataRepository.delete(coopname, username, this.toKey(key));
  }

  /**
   * Ключ из контракта — строка, в ядре — перечень `cooptypes`. Приведение живёт
   * здесь, на границе: репозиторий и раньше принимал произвольную строку
   * наравне с перечнем, а тащить `cooptypes` в контракт нельзя (INV-014).
   */
  private toKey(key: string): Cooperative.Model.UdataKey {
    return key as Cooperative.Model.UdataKey;
  }
}
