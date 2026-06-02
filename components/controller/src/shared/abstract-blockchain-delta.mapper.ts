import type { IBlockchainDeltaMapper } from './interfaces/blockchain-sync.interface';
import type { IDelta } from '~/types/common';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';

/**
 * Story 6.2 (Epic 6, ADR-008): декларативное описание подписанных документов
 * на mapper'е. Заменяет ручной вызов `DomainToBlockchainUtils.convertChainDocumentToDomainFormat`
 * в каждом mapper'е — в новом маппере это легко забыть.
 *
 * Поддерживаются вложенные пути с массивами через bracket-нотацию:
 *   `appendix`                                — top-level
 *   `statement.attachments[].signed_attachment` — массив объектов с вложенным документом
 *
 * Содержательная валидация подписанных документов (число подписей, криптография) — НЕ
 * ответственность бэкенда: это домен контракта (`require_auth`). Mapper только
 * структурно нормализует `meta: JSON-string → object`.
 */
export type SignedDocField = {
  /**
   * Dot-path к полю с `IChainDocument2`. Bracket `[]` — итерация по массиву.
   * Примеры: `appendix`, `statement.attachments[].signed_attachment`.
   */
  path: string;
};

type PathSegment = { kind: 'field'; key: string } | { kind: 'array' };

/**
 * Парсит path вида `a.b[].c` в массив сегментов:
 *   `a`       → [{field a}]
 *   `a[]`     → [{field a}, {array}]
 *   `a.b[].c` → [{field a}, {field b}, {array}, {field c}]
 *
 * Bracket-индекс `a[0]` НЕ поддерживается — намеренно (mapper'ы должны
 * декларировать все элементы массива одинаково; одиночные индексы — это
 * императивная нормализация, не декларативная).
 */
export function parseSignedDocPath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  for (const part of path.split('.')) {
    const match = part.match(/^(.+?)\[\]$/);
    if (match) {
      segments.push({ kind: 'field', key: match[1] });
      segments.push({ kind: 'array' });
    } else {
      segments.push({ kind: 'field', key: part });
    }
  }
  return segments;
}

/**
 * In-place applies `transform` to the value at the end of `segments` in `target`.
 * Если по пути встречается undefined / null / неподходящий тип — no-op (тихая нормализация
 * отсутствующих полей это OK; mapper-контракт не требует, чтобы все signed-docs всегда были).
 */
function applyAtPath(target: any, segments: ReadonlyArray<PathSegment>, transform: (v: any) => any): void {
  if (target == null || segments.length === 0) return;
  const [head, ...rest] = segments;

  if (head.kind === 'array') {
    if (!Array.isArray(target)) return;
    if (rest.length === 0) {
      // path ...x[] без чего-то после []: нормализовать каждый элемент массива целиком
      for (let i = 0; i < target.length; i++) target[i] = transform(target[i]);
      return;
    }
    for (const item of target) applyAtPath(item, rest, transform);
    return;
  }

  // 'field'
  const next = target[head.key];
  if (rest.length === 0) {
    if (next != null) target[head.key] = transform(next);
    return;
  }
  applyAtPath(next, rest, transform);
}

/**
 * Абстрактный базовый класс для всех блокчейн дельта-мапперов.
 * Story 6.2: добавлены `signedDocumentFields` + `normalizeSignedDocuments(...)`
 * для декларативной нормализации подписанных документов.
 */
export abstract class AbstractBlockchainDeltaMapper<TBlockchainData = any, TDomainEntity = any>
  implements IBlockchainDeltaMapper<TBlockchainData, TDomainEntity>
{
  /**
   * Список путей в `TBlockchainData`, по которым лежат подписанные документы
   * формата `IChainDocument2`. Переопределяется в наследнике; по умолчанию пусто.
   */
  protected readonly signedDocumentFields: ReadonlyArray<SignedDocField> = [];

  /**
   * Получение всех возможных паттернов событий для подписки
   * Возвращает массив паттернов типа "delta::contract::table"
   */
  getAllEventPatterns(): string[] {
    const patterns: string[] = [];
    const supportedContracts = this.getSupportedContractNames();
    const supportedTables = this.getSupportedTableNames();

    for (const contractName of supportedContracts) {
      for (const tableName of supportedTables) {
        patterns.push(`delta::${contractName}::${tableName}`);
      }
    }

    return patterns;
  }

  /**
   * Story 6.2: нормализует все подписанные документы в `data` согласно
   * `signedDocumentFields`. Mapper, описавший `signedDocumentFields`, обязан
   * вызвать этот helper в `mapDeltaToBlockchainData` (контрактный тест).
   *
   * Аргумент `data` мутируется — для immutability передавайте shallow-copy.
   * Возвращает тот же объект для удобства цепочки.
   */
  protected normalizeSignedDocuments<T>(data: T): T {
    if (this.signedDocumentFields.length === 0 || data == null) return data;
    for (const field of this.signedDocumentFields) {
      const segments = parseSignedDocPath(field.path);
      applyAtPath(data, segments, (chainDoc) => {
        if (chainDoc == null) return chainDoc;
        return DomainToBlockchainUtils.convertChainDocumentToDomainFormat(chainDoc);
      });
    }
    return data;
  }

  // Абстрактные методы, которые должны быть реализованы в дочерних классах
  abstract getSupportedContractNames(): string[];
  abstract getSupportedTableNames(): string[];
  abstract mapDeltaToBlockchainData(delta: IDelta): TBlockchainData | null;
  abstract extractSyncValue(delta: IDelta): string;
  abstract extractSyncKey(): string;
}
