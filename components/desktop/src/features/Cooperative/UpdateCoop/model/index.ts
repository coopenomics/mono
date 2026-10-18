import { TransactResult } from '@wharfkit/session';
import { RegistratorContract } from 'cooptypes';
import { useSessionStore } from 'src/entities/Session';
import { useGlobalStore } from 'src/shared/store';

export function useUpdateCoop() {
  async function updateCoop(
    data: RegistratorContract.Actions.UpdateCoop.IUpdateCoop
  ): Promise<TransactResult | undefined> {
    const session = useSessionStore();

    const result = useGlobalStore().transact({
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.UpdateCoop.actionName,
      authorization: [
        {
          actor: session.username,
          permission: 'active',
        },
      ],
      data,
    });

    return result;
  }

  // Смена адреса кабинета: updatecoop переписывает и взносы с описанием,
  // поэтому они уходят из текущей записи кооператива без изменений.
  async function changeCoopDomain(
    coop: RegistratorContract.Tables.Cooperatives.ICooperative,
    announce: string,
  ): Promise<TransactResult | undefined> {
    return updateCoop({
      coopname: coop.username,
      username: coop.username,
      initial: coop.initial,
      minimum: coop.minimum,
      org_initial: coop.org_initial,
      org_minimum: coop.org_minimum,
      announce: announce.trim().replace(/\.$/, '').toLowerCase(),
      description: coop.description,
    });
  }

  return { updateCoop, changeCoopDomain };
}
