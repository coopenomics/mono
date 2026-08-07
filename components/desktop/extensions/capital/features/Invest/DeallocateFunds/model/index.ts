import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { deallocateFunds, loadDeallocationLimit } from '../api';
import type { IDeallocationLimit } from 'app/extensions/capital/entities/Invest/model/types';

export function useDeallocateFunds() {
  const { info } = useSystemStore();

  async function fetchLimit(projectHash: string): Promise<IDeallocationLimit> {
    return loadDeallocationLimit({
      coopname: info.coopname,
      project_hash: projectHash,
    });
  }

  async function submitDeallocation(projectHash: string, rawAmount: string) {
    const symbol = info.symbols.root_govern_symbol;
    const precision = info.symbols.root_govern_precision;
    const amount = formatToAsset(rawAmount, symbol, precision);

    return deallocateFunds({
      coopname: info.coopname,
      project_hash: projectHash,
      amount,
    });
  }

  return { fetchLimit, submitDeallocation };
}
