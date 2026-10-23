import { client } from 'src/shared/api/client'
import { Mutations, Queries } from '@coopenomics/sdk'
import type { ICandidateIntake, IGenerateRegistrationDocumentsInput, IGenerateRegistrationDocumentsOutput } from '../model'

/**
 * Генерация всех документов регистрации для пайщика
 */
async function generateRegistrationDocuments(
  data: IGenerateRegistrationDocumentsInput
): Promise<IGenerateRegistrationDocumentsOutput> {

  const { [Mutations.Registration.GenerateRegistrationDocuments.name]: output } =
    await client.Mutation(Mutations.Registration.GenerateRegistrationDocuments.mutation, {
      variables: {
        data,
      },
    })

  return output
}

/**
 * Программа вступления и ответы заявителя на анкеты расширений.
 * Сервер отдаёт их председателю и членам совета.
 */
async function getCandidateIntake(username: string): Promise<ICandidateIntake> {
  const { [Queries.Registration.GetCandidateIntake.name]: output } =
    await client.Query(Queries.Registration.GetCandidateIntake.query, {
      variables: { username },
    })

  return output
}

export const api = {
  generateRegistrationDocuments,
  getCandidateIntake,
}
