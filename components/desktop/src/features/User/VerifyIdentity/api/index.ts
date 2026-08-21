import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IVerifyParticipantInput = Mutations.Verification.VerifyParticipantOnsite.IInput['data'];
export type IUnverifyParticipantInput = Mutations.Verification.UnverifyParticipant.IInput['data'];
export type IParticipantIdentityInput =
  Queries.Verification.ParticipantIdentityForVerification.IInput['data'];
export type IParticipantIdentity =
  Queries.Verification.ParticipantIdentityForVerification.IOutput[typeof Queries.Verification.ParticipantIdentityForVerification.name];
export type IVerificationPhotoInput = NonNullable<IVerifyParticipantInput['photos']>[number];

/**
 * Данные пайщика для сверки с документом. Сервер отдаёт их только тому, кто
 * вправе сверять (участок или совет), и только пока личность не подтверждена.
 */
async function getIdentityForVerification(data: IParticipantIdentityInput): Promise<IParticipantIdentity> {
  const { [Queries.Verification.ParticipantIdentityForVerification.name]: result } = await client.Query(
    Queries.Verification.ParticipantIdentityForVerification.query,
    { variables: { data } },
  );
  return result;
}

/**
 * Подтвердить личность пайщика по паспорту при личной явке. Полномочия
 * проверяет контракт: с указанным участком — председатель участка или его
 * доверенное лицо, без участка — председатель совета кооператива.
 * Со снимками сверки запись уходит на проверку совета.
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
  getIdentityForVerification,
  verifyParticipant,
  unverifyParticipant,
};
