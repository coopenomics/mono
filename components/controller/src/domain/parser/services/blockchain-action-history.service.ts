import { Inject, Injectable } from '@nestjs/common';
import type { Cooperative } from 'cooptypes';
import type { ActionRepositoryPort } from '../ports/action-repository.port';
import { ACTION_REPOSITORY_PORT } from '../ports/action-repository.port';
import type { ActionFilterDomainInterface } from '../interfaces/parser-config-domain.interface';

/**
 * История действий цепи из собственной базы узла.
 *
 * Раньше повестка и сборщики пакетов документов ходили за ней по HTTP в
 * обозреватель парсера (`SIMPLE_EXPLORER_API`) — отдельный сервис со своей
 * mongo, живший рядом только ради этих запросов. Те же действия узел уже
 * складывает в собственную `blockchain_actions`, поэтому читаем их у себя:
 * сетевого вызова нет, история одна и та же, и отдельный обозреватель
 * перестаёт быть частью рабочего контура.
 *
 * Порядок выдачи повторяет обозреватель — от свежих блоков к старым, — потому
 * что вызывающие берут первый результат как «последнее такое действие».
 *
 * Чего здесь намеренно нет: условия `receiver = имя кооператива`. В обозревателе
 * оно было обязательным, потому что его mongo хранила каждый трейс действия — по
 * одному на каждого нотифицируемого, — и без сужения по получателю один документ
 * возвращался несколько раз. Узел же сохраняет только основной трейс (receiver
 * совпадает с account) и только действия своего кооператива, поэтому выборка уже
 * однозначна, а условие по получателю искало бы `voskhod` там, где записан
 * `soviet`, и не находило ничего.
 */
@Injectable()
export class BlockchainActionHistoryService {
  constructor(
    @Inject(ACTION_REPOSITORY_PORT)
    private readonly actionRepository: ActionRepositoryPort
  ) {}

  /**
   * Действия под фильтр, страницами. Форма ответа — как у обозревателя,
   * чтобы вызывающая сторона не переписывала разбор результата.
   */
  async find(
    filter: ActionFilterDomainInterface,
    page = 1,
    limit = 10
  ): Promise<Cooperative.Blockchain.IGetActions> {
    const result = await this.actionRepository.findMany(filter, page, limit);

    return {
      results: result.results as unknown as Cooperative.Blockchain.IAction[],
      page: result.page,
      limit: result.limit,
      total: result.total,
    };
  }

  /**
   * Последнее действие под фильтр либо null.
   *
   * Отдельный метод, потому что так история и запрашивается почти везде:
   * «есть ли действие по этому документу» — и дальше работа идёт с одним
   * действием, а не со страницей.
   */
  async findLast<T = any>(filter: ActionFilterDomainInterface): Promise<Cooperative.Blockchain.IAction<T> | null> {
    const { results } = await this.find(filter, 1, 1);
    return (results[0] as Cooperative.Blockchain.IAction<T>) ?? null;
  }

  /**
   * Тот же поиск, но запрос задан «плоско», как его принимал обозреватель:
   * `receiver` — поле самого действия, `data.document.hash` — путь внутрь
   * полезной нагрузки. Нужен там, где условие приходит снаружи одним объектом
   * и заранее не известно, какие в нём ключи.
   */
  async findByQuery(
    base: Pick<ActionFilterDomainInterface, 'account' | 'name'>,
    query: Record<string, unknown>,
    page = 1,
    limit = 10
  ): Promise<Cooperative.Blockchain.IGetActions> {
    const filter: ActionFilterDomainInterface = { ...base };
    const data: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      this.assignQueryKey(filter, data, key, value);
    }

    if (Object.keys(data).length > 0) filter.data = data;

    return this.find(filter, page, limit);
  }

  /**
   * Разложить пару из плоского запроса: часть ключей — поля самого действия,
   * остальные относятся к полезной нагрузке. Так этот запрос и строился у
   * обозревателя, где поля действия и поля data лежали в одном объекте.
   */
  private assignQueryKey(
    filter: ActionFilterDomainInterface,
    data: Record<string, string>,
    key: string,
    value: unknown
  ): void {
    if (key.startsWith('data.')) {
      data[key.slice('data.'.length)] = String(value);
      return;
    }
    if (key === 'block_num') {
      filter.block_num = Number(value);
      return;
    }
    if (key === 'account' || key === 'name' || key === 'receiver' || key === 'global_sequence') {
      filter[key] = String(value);
      return;
    }
    data[key] = String(value);
  }
}

export const BLOCKCHAIN_ACTION_HISTORY_SERVICE = Symbol('BlockchainActionHistoryService');
