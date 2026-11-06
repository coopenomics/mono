import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import type {
  ICreateProgramPropertyInput,
  IGeneratePropertyActInput,
  IGeneratePropertyDecisionInput,
  IGeneratePropertyStatementInput,
  IGetProgramPropertiesInput,
  IProgramPropertiesPage,
  ISignPropertyActInput,
} from '../model/types';

/** Паевые взносы имуществом пайщика — со статусами и документами процесса. */
async function loadProgramProperties(data: IGetProgramPropertiesInput): Promise<IProgramPropertiesPage> {
  const { [Queries.Capital.GetProgramProperties.name]: result } = await client.Query(Queries.Capital.GetProgramProperties.query, {
    variables: data,
  });
  return result;
}

async function generateStatement(data: IGeneratePropertyStatementInput): Promise<IGeneratedDocumentOutput> {
  const { [Mutations.Capital.GenerateCapitalizationPropertyInvestStatement.name]: result } = await client.Mutation(
    Mutations.Capital.GenerateCapitalizationPropertyInvestStatement.mutation,
    { variables: { data } },
  );
  return result;
}

async function createProgramProperty(data: ICreateProgramPropertyInput) {
  const { [Mutations.Capital.CreateProgramProperty.name]: result } = await client.Mutation(Mutations.Capital.CreateProgramProperty.mutation, {
    variables: { data },
  });
  return result;
}

/** Протокол совета о приёме имущества — для утверждения решения на столе совета. */
async function generateDecision(data: IGeneratePropertyDecisionInput): Promise<IGeneratedDocumentOutput> {
  const { [Mutations.Capital.GenerateCapitalizationPropertyInvestDecision.name]: result } = await client.Mutation(
    Mutations.Capital.GenerateCapitalizationPropertyInvestDecision.mutation,
    { variables: { data } },
  );
  return result;
}

/** Акт собирает сервер: позиция — из заявления, номер решения — из протокола совета. */
async function generateAct(data: IGeneratePropertyActInput): Promise<IGeneratedDocumentOutput> {
  const { [Mutations.Capital.GenerateCapitalizationPropertyInvestAct.name]: result } = await client.Mutation(
    Mutations.Capital.GenerateCapitalizationPropertyInvestAct.mutation,
    { variables: { data } },
  );
  return result;
}

async function signAct(data: ISignPropertyActInput) {
  const { [Mutations.Capital.SignProgramPropertyAct.name]: result } = await client.Mutation(Mutations.Capital.SignProgramPropertyAct.mutation, {
    variables: { data },
  });
  return result;
}

export const api = {
  loadProgramProperties,
  generateStatement,
  createProgramProperty,
  generateDecision,
  generateAct,
  signAct,
};
