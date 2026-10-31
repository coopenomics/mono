import type { Mutations, Queries } from '@coopenomics/sdk';

export type IGetProgramPropertiesInput = Queries.Capital.GetProgramProperties.IInput;
export type IProgramPropertiesPage =
  Queries.Capital.GetProgramProperties.IOutput[typeof Queries.Capital.GetProgramProperties.name];
export type IProgramProperty = IProgramPropertiesPage['items'][number];

export type IGeneratePropertyStatementInput =
  Mutations.Capital.GenerateCapitalizationPropertyInvestStatement.IInput['data'];
export type IGeneratePropertyDecisionInput =
  Mutations.Capital.GenerateCapitalizationPropertyInvestDecision.IInput['data'];
export type ICreateProgramPropertyInput = Mutations.Capital.CreateProgramProperty.IInput['data'];
export type IGeneratePropertyActInput = Mutations.Capital.GenerateCapitalizationPropertyInvestAct.IInput['data'];
export type ISignPropertyActInput = Mutations.Capital.SignProgramPropertyAct.IInput['data'];

/** Позиция имущества, которую пайщик описывает в форме заявления. */
export interface PropertyPositionForm {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  /** Оценка числом, без символа валюты. */
  amount: number | null;
}
