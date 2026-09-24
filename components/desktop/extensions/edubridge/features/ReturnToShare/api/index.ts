import type { Cooperative } from 'cooptypes';
import { Mutations, Queries, type Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { DigitalDocument } from 'src/shared/lib/document';
import { programsForAnnulment } from 'src/features/Membership/ExitFromCoop/model';
import { EDU_LEARNER_PROGRAM_ID, type IDeclineReturnInput, type IProgramAnnulmentDocument, type IRequestReturnInput } from '../model';
import { t } from '../../../i18n';

export async function fetchReturnBalance() {
  const { [Queries.Edubridge.ReturnBalance.name]: result } = await client.Query(Queries.Edubridge.ReturnBalance.query);
  return result;
}

export async function fetchMyReturnRequests() {
  const { [Queries.Edubridge.MyReturnRequests.name]: result } = await client.Query(Queries.Edubridge.MyReturnRequests.query);
  return result;
}

export async function fetchReturnRequests(status?: Zeus.EduReturnStatus | null) {
  const { [Queries.Edubridge.ReturnRequests.name]: result } = await client.Query(Queries.Edubridge.ReturnRequests.query, {
    variables: { status },
  });
  return result;
}

/**
 * Заявление об аннулировании соглашения об участии в программе (190) — тот же
 * бланк, что при выходе из кооператива, но без выхода и с одной программой в
 * таблице. Строки и суммы берутся из предрасчёта выхода: остаток кошелька
 * программы и возврат по действующим подпискам.
 */
export async function buildProgramAnnulment(): Promise<IProgramAnnulmentDocument> {
  const session = useSessionStore();
  const system = useSystemStore();
  const username = session.username;
  if (!username) throw new Error(t('edubridge.error.notAuthorized'));
  const coopname = system.info.coopname;

  const { [Queries.MembershipExit.MembershipExitReturnPreview.name]: preview } = await client.Query(
    Queries.MembershipExit.MembershipExitReturnPreview.query,
    { variables: { coopname, username } },
  );
  const programs = programsForAnnulment(preview).filter((p) => p.program_id === EDU_LEARNER_PROGRAM_ID);
  if (!programs.length) throw new Error(t('edubridge.error.programAgreementNotFound'));

  const { [Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.name]: document } = await client.Mutation(
    Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.mutation,
    {
      variables: {
        data: { coopname, username, skip_save: false, programs, total_refund: programs[0].refund },
        options: { lang: 'ru' },
      },
    },
  );
  return document;
}

export async function requestReturn(document: IProgramAnnulmentDocument) {
  const session = useSessionStore();
  const username = session.username;
  if (!username) throw new Error(t('edubridge.error.notAuthorized'));
  const signed = await new DigitalDocument(document).sign<Cooperative.Registry.ProgramAgreementsAnnulmentStatement.Meta>(username);
  const data: IRequestReturnInput = { document: signed };
  const { [Mutations.Edubridge.RequestReturn.name]: result } = await client.Mutation(Mutations.Edubridge.RequestReturn.mutation, {
    variables: { data },
  });
  return result;
}

export async function approveReturn(id: string) {
  const { [Mutations.Edubridge.ApproveReturn.name]: result } = await client.Mutation(Mutations.Edubridge.ApproveReturn.mutation, {
    variables: { id },
  });
  return result;
}

export async function declineReturn(data: IDeclineReturnInput) {
  const { [Mutations.Edubridge.DeclineReturn.name]: result } = await client.Mutation(Mutations.Edubridge.DeclineReturn.mutation, {
    variables: { data },
  });
  return result;
}
