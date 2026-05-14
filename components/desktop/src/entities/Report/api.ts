import { client } from 'src/shared/api/client';
import { Queries, Mutations } from '@coopenomics/sdk';
import type {
  IAvailableReport,
  IBuildInitialReportEdits,
  IFieldError,
  IGeneratedReport,
  IReportCalendarRow,
  IReportHistoryPage,
  IReportHistoryFilterInput,
  IReportRequisitesView,
  IReportReadinessView,
  IReportDraft,
  IListReportDraftsFilterInput,
  ISaveReportDraftInput,
  IUpdateReportRequisitesInput,
  IReportType,
  IMarkReportPeriodInput,
} from './types';

async function getAvailableReports(): Promise<IAvailableReport[]> {
  const { [Queries.Reports.GetAvailableReports.name]: output } = await client.Query(
    Queries.Reports.GetAvailableReports.query,
  );
  return output ?? [];
}

async function getReport(id: string): Promise<IGeneratedReport | undefined> {
  const { [Queries.Reports.GetReport.name]: output } = await client.Query(
    Queries.Reports.GetReport.query,
    { variables: { id } },
  );
  return output;
}

async function getReportHistory(
  filter?: IReportHistoryFilterInput,
): Promise<IReportHistoryPage | undefined> {
  const { [Queries.Reports.GetReportHistory.name]: output } = await client.Query(
    Queries.Reports.GetReportHistory.query,
    { variables: { filter } },
  );
  return output;
}

async function getReportRequisites(): Promise<IReportRequisitesView | undefined> {
  const { [Queries.Reports.GetReportRequisites.name]: output } = await client.Query(
    Queries.Reports.GetReportRequisites.query,
  );
  return output;
}

async function checkReportReadiness(reportType: IReportType): Promise<IReportReadinessView | undefined> {
  const { [Queries.Reports.CheckReportReadiness.name]: output } = await client.Query(
    Queries.Reports.CheckReportReadiness.query,
    { variables: { reportType } },
  );
  return output;
}

async function buildInitialReportEdits(
  reportType: IReportType,
  year: number,
  period?: number | null,
): Promise<IBuildInitialReportEdits | undefined> {
  const { [Queries.Reports.BuildInitialReportEdits.name]: output } = await client.Query(
    Queries.Reports.BuildInitialReportEdits.query,
    { variables: { reportType, year, period: period ?? null } },
  );
  return output;
}

async function getReportDraft(
  reportType: IReportType,
  year: number,
  period?: number | null,
): Promise<IReportDraft | undefined> {
  const { [Queries.Reports.GetReportDraft.name]: output } = await client.Query(
    Queries.Reports.GetReportDraft.query,
    { variables: { reportType, year, period: period ?? null } },
  );
  return output ?? undefined;
}

async function listReportDrafts(
  filter?: IListReportDraftsFilterInput,
): Promise<IReportDraft[]> {
  const { [Queries.Reports.ListReportDrafts.name]: output } = await client.Query(
    Queries.Reports.ListReportDrafts.query,
    { variables: { filter } },
  );
  return output ?? [];
}

async function saveReportDraft(input: ISaveReportDraftInput): Promise<IReportDraft | undefined> {
  const { [Mutations.Reports.SaveReportDraft.name]: output } = await client.Mutation(
    Mutations.Reports.SaveReportDraft.mutation,
    { variables: { input } },
  );
  return output;
}

async function deleteReportDraft(id: string): Promise<boolean> {
  const { [Mutations.Reports.DeleteReportDraft.name]: output } = await client.Mutation(
    Mutations.Reports.DeleteReportDraft.mutation,
    { variables: { id } },
  );
  return output ?? false;
}

async function generateReportFromEdits(
  reportType: IReportType,
  year: number,
  period: number | null | undefined,
  editsJson: string,
): Promise<IGeneratedReport | undefined> {
  const { [Mutations.Reports.GenerateReportFromEdits.name]: output } = await client.Mutation(
    Mutations.Reports.GenerateReportFromEdits.mutation,
    { variables: { reportType, year, period: period ?? null, editsJson } },
  );
  return output;
}

async function getReportCalendar(year: number): Promise<IReportCalendarRow[]> {
  const { [Queries.Reports.GetReportCalendar.name]: output } = await client.Query(
    Queries.Reports.GetReportCalendar.query,
    { variables: { year } },
  );
  return output ?? [];
}

async function validateReportEdits(
  reportType: IReportType,
  editsJson: string,
): Promise<IFieldError[]> {
  const { [Queries.Reports.ValidateReportEdits.name]: output } = await client.Query(
    Queries.Reports.ValidateReportEdits.query,
    { variables: { reportType, editsJson } },
  );
  return output ?? [];
}

async function updateReportRequisites(
  input: IUpdateReportRequisitesInput,
): Promise<IReportRequisitesView | undefined> {
  const { [Mutations.Reports.UpdateReportRequisites.name]: output } = await client.Mutation(
    Mutations.Reports.UpdateReportRequisites.mutation,
    { variables: { input } },
  );
  return output;
}

async function markReportPeriod(
  data: IMarkReportPeriodInput,
): Promise<boolean> {
  const { [Mutations.Reports.MarkReportPeriod.name]: output } = await client.Mutation(
    Mutations.Reports.MarkReportPeriod.mutation,
    { variables: { data } },
  );
  return output ?? false;
}

export const reportApi = {
  getAvailableReports,
  getReport,
  getReportHistory,
  getReportRequisites,
  checkReportReadiness,
  buildInitialReportEdits,
  getReportDraft,
  listReportDrafts,
  saveReportDraft,
  deleteReportDraft,
  generateReportFromEdits,
  validateReportEdits,
  getReportCalendar,
  updateReportRequisites,
  markReportPeriod,
};
