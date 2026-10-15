import { computed, reactive, watch, type ComputedRef } from 'vue';
import { useAccountStore } from 'src/entities/Account/model';
import type { IAccount } from 'src/entities/Account/types';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { getName } from 'src/shared/lib/utils';
import type { VerificationNaming } from 'src/shared/lib/verification';

/**
 * Подписи уровней верификации — человеческими именами: кто сверил личность и на
 * каком участке. Служебные account-id и имена участков в цепи остаются запасным
 * вариантом, когда человеческого имени нет.
 *
 * Сверявший (председатель, доверенное лицо участка) может не попасть в уже
 * загруженные записи. Поэтому имена берём из переданных аккаунтов, а
 * недостающие дочитываем по одному и запоминаем.
 */
export function useVerificationNaming(
  known: () => IAccount[] = () => [],
): ComputedRef<VerificationNaming> {
  const accountStore = useAccountStore();
  const branchStore = useBranchStore();
  const systemStore = useSystemStore();

  const knownNames = reactive(new Map<string, string>());
  const requestedNames = new Set<string>();

  const resolveName = (username: string): string => {
    const name = knownNames.get(username);
    if (name !== undefined) return name;
    if (username && !requestedNames.has(username)) {
      requestedNames.add(username);
      void accountStore
        .fetchAccount(username)
        .then((account) => knownNames.set(username, (account && getName(account)) || ''))
        .catch(() => knownNames.set(username, ''));
    }
    return '';
  };

  watch(
    known,
    (items) => {
      for (const account of items) knownNames.set(account.username, getName(account) || '');
    },
    { immediate: true },
  );

  // Названия участков нужны только для подписи «где сверили» — грузим их один
  // раз и не роняем экран, если участков в кооперативе нет.
  if (!branchStore.publicBranches.length) {
    void branchStore
      .loadPublicBranches({ coopname: systemStore.info.coopname })
      .catch(() => undefined);
  }

  return computed((): VerificationNaming => {
    const branches = new Map(
      branchStore.publicBranches.map((branch) => [
        branch.braname,
        branch.short_name || branch.full_name || branch.braname,
      ]),
    );
    return {
      attestorName: resolveName,
      branchName: (braname: string) => branches.get(braname) || '',
    };
  });
}
