import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { Cooperative } from 'cooptypes';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';

export type IGenerateCooperativeInvestStatementData =
  Mutations.Wallet.GenerateCooperativeInvestStatementDocument.IInput['data'];
export type IGenerateCooperativeInvestStatementResult =
  Mutations.Wallet.GenerateCooperativeInvestStatementDocument.IOutput[typeof Mutations.Wallet.GenerateCooperativeInvestStatementDocument.name];

export type IGenerateCooperativeInvestDecisionData =
  Mutations.Wallet.GenerateCooperativeInvestDecisionDocument.IInput['data'];
export type IGenerateCooperativeInvestDecisionResult =
  Mutations.Wallet.GenerateCooperativeInvestDecisionDocument.IOutput[typeof Mutations.Wallet.GenerateCooperativeInvestDecisionDocument.name];

export type ICreateCooperativeInvestmentData =
  Mutations.Wallet.CreateCooperativeInvestment.IInput['data'];
export type ICreateCooperativeInvestmentResult =
  Mutations.Wallet.CreateCooperativeInvestment.IOutput[typeof Mutations.Wallet.CreateCooperativeInvestment.name];

export type IOperatorWallet =
  Queries.Wallet.GetOperatorWallets.IOutput[typeof Queries.Wallet.GetOperatorWallets.name][number];

/**
 * Композабл инвестирования средств кооператива в ЦПП кооператива-оператора:
 * заявление председателя → решение совета → исходящий платёж кассиру.
 */
export function useCooperativeInvest() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /**
   * Генерирует документ заявления об инвестировании (1200).
   * Реквизиты оператора в текст заявления подставляет бэкенд.
   */
  async function generateCooperativeInvestStatement(
    data: Omit<IGenerateCooperativeInvestStatementData, 'coopname'>,
  ): Promise<IGenerateCooperativeInvestStatementResult> {
    const {
      [Mutations.Wallet.GenerateCooperativeInvestStatementDocument.name]: result,
    } = await client.Mutation(
      Mutations.Wallet.GenerateCooperativeInvestStatementDocument.mutation,
      {
        variables: {
          data: {
            coopname: info.coopname,
            ...data,
          },
        },
      },
    );

    return result;
  }

  /**
   * Генерирует документ решения совета об инвестировании (1201)
   */
  async function generateCooperativeInvestDecision(
    data: Omit<IGenerateCooperativeInvestDecisionData, 'coopname'>,
  ): Promise<IGenerateCooperativeInvestDecisionResult> {
    const {
      [Mutations.Wallet.GenerateCooperativeInvestDecisionDocument.name]: result,
    } = await client.Mutation(
      Mutations.Wallet.GenerateCooperativeInvestDecisionDocument.mutation,
      {
        variables: {
          data: {
            coopname: info.coopname,
            ...data,
          },
          options: {
            lang: 'ru',
          },
        },
      },
    );

    return result;
  }

  /**
   * Создаёт заявку кооператива на инвестирование (вопрос ставится на повестку совета)
   */
  async function createCooperativeInvestment(
    input: Omit<ICreateCooperativeInvestmentData, 'coopname'>,
  ): Promise<ICreateCooperativeInvestmentResult> {
    const { [Mutations.Wallet.CreateCooperativeInvestment.name]: result } =
      await client.Mutation(Mutations.Wallet.CreateCooperativeInvestment.mutation, {
        variables: {
          data: {
            coopname: info.coopname,
            ...input,
          },
        },
      });

    return result;
  }

  /**
   * Полный процесс создания заявки на инвестирование:
   * 1. Генерирует уникальный payment_hash
   * 2. Генерирует документ заявления с payment_hash
   * 3. Подписывает его
   * 4. Создаёт заявку с тем же payment_hash
   */
  async function processCooperativeInvest(data: {
    quantity: number;
    symbol: string;
  }): Promise<ICreateCooperativeInvestmentResult> {
    const payment_hash = await generateUniqueHash();

    const document = await generateCooperativeInvestStatement({
      username: session.username,
      quantity: data.quantity.toString(),
      currency: data.symbol,
      payment_hash,
    });

    const digitalDocument = new DigitalDocument(document);
    const signedDocument =
      await digitalDocument.sign<Cooperative.Registry.CooperativeInvestStatement.Meta>(
        session.username,
      );

    return await createCooperativeInvestment({
      quantity: data.quantity,
      symbol: data.symbol,
      statement: signedDocument,
      payment_hash,
    });
  }

  /**
   * Балансы кошельков кооператива на бэкенде оператора
   */
  async function getOperatorWallets(): Promise<IOperatorWallet[]> {
    const { [Queries.Wallet.GetOperatorWallets.name]: result } = await client.Query(
      Queries.Wallet.GetOperatorWallets.query,
      { variables: {} },
    );
    return result ?? [];
  }

  return {
    generateCooperativeInvestStatement,
    generateCooperativeInvestDecision,
    createCooperativeInvestment,
    processCooperativeInvest,
    getOperatorWallets,
  };
}
