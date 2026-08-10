/**
 * Кэш справочных чтений на время одного расчёта прав.
 *
 * Права считаются поэлементно, и на каждый элемент списка заново спрашиваются одни и те же
 * строки: проект по хешу, допуск пользователя к проекту, его участие и сегмент. На выборке
 * из 200 задач это тысячи одинаковых запросов к БД. Кэш живёт ровно один вызов (список или
 * одиночный расчёт) и наружу не переиспользуется — устаревших прав он показать не может.
 */
export class PermissionsLookupCache {
  private readonly entries = new Map<string, Promise<unknown>>();

  /** Значение по ключу: первый вызов грузит, остальные ждут тот же промис. */
  once<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      return hit as Promise<T>;
    }
    const loading = load().catch((error) => {
      // Неудачное чтение не кэшируем: следующий вызов в этом же запросе должен попробовать снова.
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, loading);
    return loading;
  }

  static projectKey(projectHash: string): string {
    return `project:${projectHash}`;
  }

  static confirmedClearanceKey(username: string, projectHash: string): string {
    return `clearance:confirmed:${username}:${projectHash}`;
  }

  static createdClearanceKey(username: string, projectHash: string): string {
    return `clearance:created:${username}:${projectHash}`;
  }

  static segmentKey(username: string, coopname: string, projectHash: string): string {
    return `segment:${username}:${coopname}:${projectHash}`;
  }

  static contributorKey(username: string, coopname: string): string {
    return `contributor:${username}:${coopname}`;
  }

  static componentsKey(parentHash: string): string {
    return `components:${parentHash}`;
  }
}
