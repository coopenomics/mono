import { Injectable } from '@nestjs/common';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { ValidateJournalInvariantInputDTO } from '../dto/validate-journal-input.dto';
import { ValidateJournalInvariantResultDTO } from '../dto/validate-journal-output.dto';

const LEDGER2_CONTRACT = 'ledger2';
const JOURNAL_TABLE = 'journal';

/**
 * Запись журнала двойных проводок ledger2 в том виде, в каком её возвращает wharfkit.
 * amount — это eosio::asset, сериализуемый Antelope в строку вида "100.0000 RUB".
 * created_at — ISO timestamp.
 */
interface Ledger2JournalRow {
  id: number | string;
  debit_account_id: number | string;
  credit_account_id: number | string;
  amount: string;
  action_code: string;
  wjournal_entry_id: number | string;
  operation_hash: string;
  memo: string;
  created_at: string;
}

/**
 * Разбирает asset "100.0000 RUB" → { amount: 1000000n (minor units), symbol: "RUB" }.
 * Используются bigint-минимальные-единицы, чтобы избежать float-погрешностей.
 */
function parseAsset(raw: string): { amount: bigint; symbol: string } {
  const trimmed = raw.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx < 0) {
    throw new Error(`Некорректный asset: "${raw}"`);
  }
  const numericPart = trimmed.slice(0, spaceIdx);
  const symbol = trimmed.slice(spaceIdx + 1);

  const negative = numericPart.startsWith('-');
  const unsigned = negative ? numericPart.slice(1) : numericPart;
  const dotIdx = unsigned.indexOf('.');

  let whole: string;
  let fractional: string;
  if (dotIdx < 0) {
    whole = unsigned;
    fractional = '';
  } else {
    whole = unsigned.slice(0, dotIdx);
    fractional = unsigned.slice(dotIdx + 1);
  }

  const digits = (whole || '0') + fractional;
  if (!/^\d+$/.test(digits)) {
    throw new Error(`Некорректные цифры в asset: "${raw}"`);
  }

  const value = BigInt(digits);
  return { amount: negative ? -value : value, symbol };
}

@Injectable()
export class Ledger2Service {
  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * Перечисляет записи таблицы journal (scope = coopname), фильтрует по
   * created_at в указанном диапазоне и возвращает суммарные обороты.
   */
  async validateJournalInvariant(
    input: ValidateJournalInvariantInputDTO
  ): Promise<ValidateJournalInvariantResultDTO> {
    const rows = await this.blockchainService.getAllRows<Ledger2JournalRow>(
      LEDGER2_CONTRACT,
      input.coopname,
      JOURNAL_TABLE
    );

    const fromMs = input.fromDate ? input.fromDate.getTime() : undefined;
    const toMs = input.toDate ? input.toDate.getTime() : undefined;

    let totalDebit = 0n;
    let totalCredit = 0n;
    let entriesCount = 0;
    let symbol: string | undefined;

    for (const row of rows) {
      const createdMs = Date.parse(row.created_at);
      if (Number.isNaN(createdMs)) continue;
      if (fromMs !== undefined && createdMs < fromMs) continue;
      if (toMs !== undefined && createdMs > toMs) continue;

      const { amount, symbol: rowSymbol } = parseAsset(row.amount);
      if (symbol === undefined) symbol = rowSymbol;

      totalDebit += amount;
      totalCredit += amount;
      entriesCount += 1;
    }

    const difference = totalDebit - totalCredit;

    return {
      coopname: input.coopname,
      fromDate: input.fromDate,
      toDate: input.toDate,
      entriesCount,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      difference: difference.toString(),
      symbol,
      ok: difference === 0n,
    };
  }
}
