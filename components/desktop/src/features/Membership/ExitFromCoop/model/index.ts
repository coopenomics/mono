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

export type IGenerateProgramAgreementsAnnulmentResult =
  Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.IOutput[typeof Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.name];

/** Документы, которые пайщик подписывает при выходе: заявление и аннулирование соглашений. */
export interface IExitDocuments {
  exit_hash: string;
  application: IGenerateMembershipExitApplicationResult;
  /** Пусто, когда у пайщика нет соглашений об участии в программах. */
  annulment: IGenerateProgramAgreementsAnnulmentResult | null;
}

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
   * Заявление об аннулировании соглашений ЦПП (190). Программы и остатки берутся
   * из предрасчёта выхода — того же, что показывается пайщику в диалоге.
   */
  async function generateAnnulment(
    exit_hash: string,
    preview: IMembershipExitReturnPreview,
  ): Promise<IGenerateProgramAgreementsAnnulmentResult> {
    const {
      [Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.name]: result,
    } = await client.Mutation(
      Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.mutation,
      {
        variables: {
          data: {
            coopname: info.coopname,
            username: session.username,
            skip_save: false,
            exit_hash,
            programs: programsForAnnulment(preview),
            total_refund: preview.total,
          },
          options: { lang: 'ru' },
        },
      },
    );

    return result;
  }

  /**
   * Оба документа выхода под общим `exit_hash`: заявление о выходе и, когда у
   * пайщика есть соглашения об участии в программах, заявление об их
   * аннулировании. Пайщик читает оба и подписывает одним действием.
   */
  async function prepareExitDocuments(
    preview: IMembershipExitReturnPreview | null,
  ): Promise<IExitDocuments> {
    const exit_hash = await generateUniqueHash();
    const application = await generateApplication();
    const needsAnnulment = preview ? programsForAnnulment(preview).length > 0 : false;
    const annulment = needsAnnulment && preview ? await generateAnnulment(exit_hash, preview) : null;
    return { exit_hash, application, annulment };
  }

  /**
   * Шаг 2: подписывает показанный документ приватным ключом пайщика и подаёт
   * заявление. На бэкенде заявление принимается и уходит письмо с подтверждением —
   * в блокчейн отправится только после перехода по ссылке (confirmExit).
   */
  async function submitSignedApplication(documents: IExitDocuments): Promise<ICreateMembershipExitResult> {
    const statement = await new DigitalDocument(documents.application)
      .sign<Cooperative.Registry.ParticipantExitApplication.Meta>(session.username);

    // Аннулирование соглашений подписывается тем же действием: пайщик читает оба
    // документа и ставит подпись один раз.
    const annulment = documents.annulment
      ? await new DigitalDocument(documents.annulment)
        .sign<Cooperative.Registry.ProgramAgreementsAnnulmentStatement.Meta>(session.username)
      : undefined;

    return createMembershipExit({
      exit_hash: documents.exit_hash,
      statement,
      annulment,
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
    generateAnnulment,
    prepareExitDocuments,
    submitSignedApplication,
    createMembershipExit,
    confirmExit,
    getReturnPreview,
    hasRequisites,
  };
}

/**
 * Программы для заявления об аннулировании: те, по которым у пайщика есть
 * подписанное соглашение. Минимальный паевой взнос и прочее вне программ в
 * документ не идут — аннулировать там нечего.
 */
export function programsForAnnulment(preview: IMembershipExitReturnPreview) {
  return (preview.programs ?? [])
    .filter((program) => Boolean(program.agreement_hash) && program.program_id > 0)
    .map((program) => ({
      program_id: program.program_id,
      title: program.title,
      agreement_signed_at: program.agreement_signed_at ?? '',
      agreement_hash: program.agreement_hash ?? '',
      refund: program.refund,
      wallets: program.wallets.map((wallet) => ({
        wallet_name: wallet.wallet_name,
        human_name: wallet.human_name,
        balance: wallet.balance,
        returns: wallet.returns,
      })),
    }));
}
