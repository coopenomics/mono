export * from './useWithdrawDialog';
import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { Registry } from '@coopenomics/docs-templates';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';

export type IGenerateReturnByMoneyStatementData =
  Mutations.Wallet.GenerateReturnByMoneyStatementDocument.IInput['data'];
export type IGenerateReturnByMoneyStatementResult =
  Mutations.Wallet.GenerateReturnByMoneyStatementDocument.IOutput[typeof Mutations.Wallet.GenerateReturnByMoneyStatementDocument.name];

export type IGenerateReturnByMoneyDecisionData =
  Mutations.Wallet.GenerateReturnByMoneyDecisionDocument.IInput['data'];
export type IGenerateReturnByMoneyDecisionResult =
  Mutations.Wallet.GenerateReturnByMoneyDecisionDocument.IOutput[typeof Mutations.Wallet.GenerateReturnByMoneyDecisionDocument.name];

export type ICreateWithdrawData =
  Mutations.Wallet.CreateWithdraw.IInput['data'];
export type ICreateWithdrawResult =
  Mutations.Wallet.CreateWithdraw.IOutput[typeof Mutations.Wallet.CreateWithdraw.name];

/**
 * Композабл для работы с возвратом паевых взносов
 */
export function useReturnByMoney() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /**
   * Генерирует документ заявления на возврат паевого взноса
   */
  async function generateReturnByMoneyStatement(
    data: Omit<IGenerateReturnByMoneyStatementData, 'coopname'>,
  ): Promise<IGenerateReturnByMoneyStatementResult> {
    const {
      [Mutations.Wallet.GenerateReturnByMoneyStatementDocument.name]: result,
    } = await client.Mutation(
      Mutations.Wallet.GenerateReturnByMoneyStatementDocument.mutation,
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
   * Генерирует документ решения совета о возврате паевого взноса
   */
  async function generateReturnByMoneyDecision(
    data: Omit<IGenerateReturnByMoneyDecisionData, 'coopname'>,
  ): Promise<IGenerateReturnByMoneyDecisionResult> {
    const {
      [Mutations.Wallet.GenerateReturnByMoneyDecisionDocument.name]: result,
    } = await client.Mutation(
      Mutations.Wallet.GenerateReturnByMoneyDecisionDocument.mutation,
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
   * Создает заявку на вывод средств (возврат паевого взноса)
   */
  async function createWithdraw(
    input: Omit<ICreateWithdrawData, 'coopname' | 'username'>,
  ): Promise<ICreateWithdrawResult> {
    const { [Mutations.Wallet.CreateWithdraw.name]: result } =
      await client.Mutation(Mutations.Wallet.CreateWithdraw.mutation, {
        variables: {
          data: {
            coopname: info.coopname,
            username: session.username,
            ...input,
          },
        },
      });

    return result;
  }

  /**
   * Полный процесс создания заявки на возврат паевого взноса:
   * 1. Генерирует уникальный payment_hash
   * 2. Генерирует документ заявления с payment_hash
   * 3. Подписывает его
   * 4. Создает заявку на вывод с тем же payment_hash
   */
  async function processReturnByMoney(data: {
    quantity: number;
    symbol: string;
    method_id: string;
  }): Promise<ICreateWithdrawResult> {
    // 1. Генерируем уникальный payment_hash
    const payment_hash = await generateUniqueHash();

    // 2. Генерируем документ заявления с payment_hash
    const document = await generateReturnByMoneyStatement({
      username: session.username,
      method_id: data.method_id,
      quantity: data.quantity.toString(),
      currency: data.symbol,
      payment_hash: payment_hash,
    });

    // 3. Подписываем документ
    const digitalDocument = new DigitalDocument(document);
    const signedDocument =
      await digitalDocument.sign<Registry.ReturnByMoney.Meta>(
        session.username,
      );

    // 4. Создаем заявку на вывод с тем же payment_hash
    const result = await createWithdraw({
      quantity: data.quantity,
      symbol: data.symbol,
      method_id: data.method_id,
      statement: signedDocument,
      payment_hash: payment_hash,
    });

    return result;
  }

  return {
    generateReturnByMoneyStatement,
    generateReturnByMoneyDecision,
    createWithdraw,
    processReturnByMoney,
  };
}
