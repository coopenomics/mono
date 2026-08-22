import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { allocateFunds } from '../api';

export function useAllocateFunds() {
  const { info } = useSystemStore();

  async function submitAllocation(projectHash: string, rawAmount: string) {
    const symbol = info.symbols.root_govern_symbol;
    const precision = info.symbols.root_govern_precision;
    const amount = formatToAsset(rawAmount, symbol, precision);

    return allocateFunds({
      coopname: info.coopname,
      project_hash: projectHash,
      amount,
    });
  }

  return { submitAllocation };
}
