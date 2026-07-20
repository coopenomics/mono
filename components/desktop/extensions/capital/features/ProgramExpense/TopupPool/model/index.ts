import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { topupProgramExpense } from '../api';

export function useTopupProgramExpensePool() {
  const { info } = useSystemStore();

  async function submitTopup(rawAmount: string) {
    const symbol = info.symbols.root_govern_symbol;
    const precision = info.symbols.root_govern_precision;
    const amount = formatToAsset(rawAmount, symbol, precision);
    return topupProgramExpense({
      coopname: info.coopname,
      amount,
    });
  }

  return { submitTopup };
}
