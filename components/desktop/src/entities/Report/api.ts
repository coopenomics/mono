import { client } from 'src/shared/api/client';
import { Queries, Mutations } from '@coopenomics/sdk';
import type {
  IAvailableReport,
  IGeneratedReport,
  IReportHistoryPage,
  IReportHistoryFilterInput,
  IReportRequisitesView,
  IReportReadinessView,
  IGenerateReportInput,
  IOrganizationDataInput,
  IUpdateReportRequisitesInput,
  IReportType,
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

async function generateReport(
  data: IGenerateReportInput,
  organization?: IOrganizationDataInput,
): Promise<IGeneratedReport | undefined> {
  const { [Mutations.Reports.GenerateReport.name]: output } = await client.Mutation(
    Mutations.Reports.GenerateReport.mutation,
    { variables: { data, organization } },
  );
  return output;
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

export const reportApi = {
  getAvailableReports,
  getReport,
  getReportHistory,
  getReportRequisites,
  checkReportReadiness,
  generateReport,
  updateReportRequisites,
};
