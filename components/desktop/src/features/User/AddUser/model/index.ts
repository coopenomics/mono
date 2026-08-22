import { api } from '../api';
import { useRegistratorStore } from 'src/entities/Registrator';
import { Mutations, Zeus } from '@coopenomics/sdk';
import emailRegex from 'email-regex';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { convertToEOSDate } from 'src/shared/lib/utils/formatDateForEos';
import { stripLegacyBankKpp } from 'src/shared/lib/utils/stripLegacyBankKpp';

const emailValidator = emailRegex({ exact: true });

export function useAddUser() {
  const { state, addUserState } = useRegistratorStore();

  function emailIsValid(email: string): boolean {
    return emailValidator.test(email);
  }

  async function addUser(): Promise<
    Mutations.Participants.AddParticipant.IOutput['addParticipant']
  > {
    const coop = useCooperativeStore();

    let initial = '';
    let minimum = '';

    if (state.userData.type === 'individual') {
      initial = `${addUserState.initial.toFixed(4)} ${coop.governSymbol}`;
      minimum = `${addUserState.minimum.toFixed(4)} ${coop.governSymbol}`;
    } else if (state.userData.type === 'organization') {
      initial = `${addUserState.org_initial.toFixed(4)} ${coop.governSymbol}`;
      minimum = `${addUserState.org_minimum.toFixed(4)} ${coop.governSymbol}`;
    } else if (state.userData.type === 'entrepreneur') {
      initial = `${addUserState.initial.toFixed(4)} ${coop.governSymbol}`;
      minimum = `${addUserState.minimum.toFixed(4)} ${coop.governSymbol}`;
    }

    const data: Mutations.Participants.AddParticipant.IInput['data'] = {
      email: state.email,
      created_at: convertToEOSDate(addUserState.created_at),
      initial,
      minimum,
      spread_initial: addUserState.spread_initial,
      type: state.userData.type as Zeus.AccountType,
      individual_data:
        state.userData.type === 'individual'
          ? (state.userData
              .individual_data as Zeus.ModelTypes['CreateIndividualDataInput'])
          : undefined,
      // TODO(удалить после 01.09.2026): stripLegacyBankKpp — временный shim persisted-localStorage
      organization_data:
        state.userData.type === 'organization'
          ? stripLegacyBankKpp(
              state.userData
                .organization_data as Zeus.ModelTypes['CreateOrganizationDataInput'],
            )
          : undefined,
      entrepreneur_data:
        state.userData.type === 'entrepreneur'
          ? stripLegacyBankKpp(
              state.userData
                .entrepreneur_data as Zeus.ModelTypes['CreateEntrepreneurDataInput'],
            )
          : undefined,
    };

    return await api.addParticipant(data);
  }

  return {
    addUser,
    emailIsValid,
  };
}
