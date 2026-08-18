/**
 * Конвертация между доменными объектами и формами, которые понимает цепь.
 *
 * Переехало из `~/shared/utils` контроллера: на утилиту ссылались 27 файлов
 * расширений, а этого пути за пределами монолита нет.
 *
 * Типы подписанного документа взяты из `cooptypes`, а не из
 * `@coopenomics/innercoop`: пакеты каркаса и контрактов ортогональны и не
 * зависят друг от друга (INV-007). Формы совпадают поле в поле, поэтому
 * результат подходит везде, где ждут контракт `ISignedDocument`, — связь
 * структурная, номинальной нет.
 */
import { Injectable } from '@nestjs/common';
import { Name } from '@wharfkit/antelope';
import type { Cooperative } from 'cooptypes';
import moment from 'moment';
import { platformSettings } from '../config/platform-settings';

@Injectable()
export class DomainToBlockchainUtils {
  /** Доменный подписанный документ → форма для отправки в цепь. */
  convertSignedDocumentToBlockchainFormat(
    document: Cooperative.Document.ISignedDocument2
  ): Cooperative.Document.IChainDocument2 {
    return {
      version: document.version,
      hash: document.hash,
      doc_hash: document.doc_hash,
      meta_hash: document.meta_hash,
      meta: JSON.stringify(document.meta),
      signatures: document.signatures,
    };
  }

  /** Документ из цепи → доменная форма. */
  convertBlockchainDocumentToDomainFormat(
    chainDoc: Cooperative.Document.IChainDocument2
  ): Cooperative.Document.ISignedDocument2 {
    return DomainToBlockchainUtils.convertChainDocumentToDomainFormat(chainDoc);
  }

  /**
   * Свернуть checksum256 и учётное имя в один uint128-ключ — так составной
   * индекс задан в контракте (`combine_checksum_ids`), и поиск по таблице
   * обязан считать ключ ровно так же.
   */
  combineChecksumAndUsername(hash: string, username: string): bigint {
    const hashBytes = Buffer.from(hash.replace(/^0x/, ''), 'hex');
    const truncatedHash = hashBytes.readBigUInt64LE(0);

    // Только Name.from даёт то же числовое представление имени, что и цепь.
    const usernameName = Name.from(username);
    const usernameValue = usernameName.value.value;

    return (BigInt(truncatedHash) << 64n) | BigInt(usernameValue.toString());
  }

  /** Дата → строка `time_point_sec`, как её принимает цепь. */
  convertDateToBlockchainFormat(date: Date | string): string {
    return moment(date).format('YYYY-MM-DDTHH:mm:ss.SSS');
  }

  /**
   * Привести строку `«число символ»` к точности, объявленной для этого символа.
   *
   * Символ сверяется с настройками контура намеренно: цепь отвергает asset с
   * чужой точностью, и поймать это лучше здесь, чем в отказе транзакции.
   */
  formatQuantityWithPrecision(quantity: string): string {
    const parts = quantity.split(' ');
    if (parts.length !== 2) {
      throw new Error(`Неверный формат quantity: ${quantity}. Ожидается "число символ"`);
    }

    const [amount, symbol] = parts;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount)) {
      throw new Error(`Некорректное числовое значение в quantity: ${amount}`);
    }

    const { rootSymbol, rootPrecision, rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;

    let precision: number;
    if (symbol === rootSymbol) {
      precision = rootPrecision;
    } else if (symbol === rootGovernSymbol) {
      precision = rootGovernPrecision;
    } else {
      throw new Error(`Неподдерживаемый символ: ${symbol}. Поддерживаются только: ${rootSymbol}, ${rootGovernSymbol}`);
    }

    return `${numericAmount.toFixed(precision)} ${symbol}`;
  }

  /** Числовая строка + точность + символ → asset-строка цепи. */
  formatNumericStringToAssetString(numericString: string, precision: number, symbol: string): string {
    const numericValue = parseFloat(numericString);

    if (isNaN(numericValue)) {
      throw new Error(`Некорректное числовое значение: ${numericString}`);
    }

    if (numericValue < 0) {
      throw new Error(`Значение не может быть отрицательным: ${numericString}`);
    }

    return `${numericValue.toFixed(precision)} ${symbol}`;
  }

  static convertChainDocumentToSignedDocument2(
    chainDoc: Cooperative.Document.IChainDocument2
  ): Cooperative.Document.ISignedDocument2 {
    return DomainToBlockchainUtils.convertChainDocumentToDomainFormat(chainDoc);
  }

  /**
   * Документ из цепи → доменная форма.
   *
   * `meta` в цепи хранится строкой JSON, а пустая строка означает «мета нет»:
   * `JSON.parse('')` на ней бросил бы.
   */
  static convertChainDocumentToDomainFormat(
    chainDoc: Cooperative.Document.IChainDocument2
  ): Cooperative.Document.ISignedDocument2 {
    return {
      version: chainDoc.version,
      hash: chainDoc.hash,
      doc_hash: chainDoc.doc_hash,
      meta_hash: chainDoc.meta_hash,
      meta: typeof chainDoc.meta === 'string' ? (chainDoc.meta === '' ? {} : JSON.parse(chainDoc.meta)) : chainDoc.meta,
      signatures: chainDoc.signatures,
    };
  }

  static getEmptyHash(): string {
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
