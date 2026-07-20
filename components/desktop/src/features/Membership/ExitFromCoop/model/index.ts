export * from './useExitDialog';
export * from './useExitGate';
import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { Cooperative } from 'cooptypes';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';

export type IGenerateMembershipExitApplicationData =
  Mutations.MembershipExit.GenerateMembershipExitApplication.IInput['data'];
export type IGenerateMembershipExitApplicationResult =
  Mutations.MembershipExit.GenerateMembershipExitApplication.IOutput[typeof Mutations.MembershipExit.GenerateMembershipExitApplication.name];

export type ICreateMembershipExitData =
  Mutations.MembershipExit.CreateMembershipExit.IInput['data'];
export type ICreateMembershipExitResult =
  Mutations.MembershipExit.CreateMembershipExit.IOutput[typeof Mutations.MembershipExit.CreateMembershipExit.name];

export type IMembershipExitReturnPreview =
  Queries.MembershipExit.MembershipExitReturnPreview.IOutput[typeof Queries.MembershipExit.MembershipExitReturnPreview.name];

/**
 * Композабл выхода пайщика из кооператива.
 */
export function useMembershipExit() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  /**
   * Генерирует документ заявления о выходе из кооператива (registry 200).
   */
  async function generateMembershipExitApplication(
    data: Omit<IGenerateMembershipExitApplicationData, 'coopname'>,
  ): Promise<IGenerateMembershipExitApplicationResult> {
    const {
      [Mutations.MembershipExit.GenerateMembershipExitApplication.name]: result,
    } = await client.Mutation(
      Mutations.MembershipExit.GenerateMembershipExitApplication.mutation,
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
   * Подаёт заявление на выход (push registrator::exitcoop).
   */
  async function createMembershipExit(
    input: Omit<ICreateMembershipExitData, 'coopname' | 'username'>,
  ): Promise<ICreateMembershipExitResult> {
    const { [Mutations.MembershipExit.CreateMembershipExit.name]: result } =
      await client.Mutation(Mutations.MembershipExit.CreateMembershipExit.mutation, {
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
   * Есть ли у пайщика реквизиты для получения возврата паевого взноса.
   * Выход блокируется, пока их нет (бэкенд это же проверяет при подаче) — без
   * реквизитов исходящий платёж возврата некуда будет создать.
   */
  async function hasRequisites(): Promise<boolean> {
    const response = await client.Query(Queries.PaymentMethods.GetPaymentMethods.query, {
      variables: {
        data: { username: session.username, limit: 1, page: 1 },
      },
    });
    const result = response?.[Queries.PaymentMethods.GetPaymentMethods.name];
    // Блокируем выход ТОЛЬКО при достоверно пустом списке методов. Если ответ
    // непонятный (null/не массив) — НЕ блокируем: авторитетную проверку сделает
    // бэкенд при подаче (createMembershipExit). Так исключаем ложный блок.
    if (!result || !Array.isArray(result.items)) return true;
    return result.items.length > 0;
  }

  /**
   * Предварительный расчёт суммы возврата паевого взноса при выходе.
   */
  async function getReturnPreview(): Promise<IMembershipExitReturnPreview> {
    const {
      [Queries.MembershipExit.MembershipExitReturnPreview.name]: result,
    } = await client.Query(
      Queries.MembershipExit.MembershipExitReturnPreview.query,
      {
        variables: {
          coopname: info.coopname,
          username: session.username,
        },
      },
    );

    return result;
  }

  /**
   * Шаг 1: генерирует документ заявления о выходе (200) — показываем пайщику
   * перед подписанием («читайте внимательно»).
   */
  async function generateApplication(): Promise<IGenerateMembershipExitApplicationResult> {
    return generateMembershipExitApplication({
      username: session.username,
      skip_save: false,
    });
  }

  /**
   * Шаг 2: подписывает показанный документ приватным ключом пайщика и подаёт
   * заявление. На бэкенде заявление принимается и уходит письмо с подтверждением —
   * в блокчейн отправится только после перехода по ссылке (confirmExit).
   */
  async function submitSignedApplication(
    document: IGenerateMembershipExitApplicationResult,
  ): Promise<ICreateMembershipExitResult> {
    const exit_hash = await generateUniqueHash();

    const digitalDocument = new DigitalDocument(document);
    const signedDocument =
      await digitalDocument.sign<Cooperative.Registry.ParticipantExitApplication.Meta>(
        session.username,
      );

    return createMembershipExit({
      exit_hash,
      statement: signedDocument,
    });
  }

  /**
   * Подтверждение выхода по токену из письма — отправляет ранее подписанное
   * заявление в блокчейн.
   */
  async function confirmExit(token: string): Promise<ICreateMembershipExitResult> {
    const { [Mutations.MembershipExit.ConfirmMembershipExit.name]: result } =
      await client.Mutation(Mutations.MembershipExit.ConfirmMembershipExit.mutation, {
        variables: { token },
      });
    return result;
  }

  return {
    generateMembershipExitApplication,
    generateApplication,
    submitSignedApplication,
    createMembershipExit,
    confirmExit,
    getReturnPreview,
    hasRequisites,
  };
}
