import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IVerifyParticipantInput = Mutations.Verification.VerifyParticipantOnsite.IInput['data'];
export type IUnverifyParticipantInput = Mutations.Verification.UnverifyParticipant.IInput['data'];

/**
 * Подтвердить личность пайщика по паспорту при личной явке. Полномочия
 * проверяет контракт: с указанным участком — председатель участка или его
 * доверенное лицо, без участка — председатель совета кооператива.
 */
async function verifyParticipant(data: IVerifyParticipantInput): Promise<void> {
  await client.Mutation(Mutations.Verification.VerifyParticipantOnsite.mutation, {
    variables: { data },
  });
}

/** Отозвать верификацию личности пайщика (председатель кооператива). */
async function unverifyParticipant(data: IUnverifyParticipantInput): Promise<void> {
  await client.Mutation(Mutations.Verification.UnverifyParticipant.mutation, {
    variables: { data },
  });
}

export const api = {
  verifyParticipant,
  unverifyParticipant,
};
