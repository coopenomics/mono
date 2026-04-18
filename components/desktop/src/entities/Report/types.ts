import type { Queries, Mutations, Zeus } from '@coopenomics/sdk';

export type IAvailableReport =
  Queries.Reports.GetAvailableReports.IOutput[typeof Queries.Reports.GetAvailableReports.name][number];

export type IGeneratedReport =
  Queries.Reports.GetReport.IOutput[typeof Queries.Reports.GetReport.name];

export type IReportHistoryPage =
  Queries.Reports.GetReportHistory.IOutput[typeof Queries.Reports.GetReportHistory.name];

export type IReportRequisitesView =
  Queries.Reports.GetReportRequisites.IOutput[typeof Queries.Reports.GetReportRequisites.name];

export type IReportReadinessView =
  Queries.Reports.CheckReportReadiness.IOutput[typeof Queries.Reports.CheckReportReadiness.name];

export type IReportHistoryFilterInput = Zeus.ModelTypes['ReportHistoryFilterInput'];
export type IGenerateReportInput = Mutations.Reports.GenerateReport.IInput['data'];
export type IOrganizationDataInput = Zeus.ModelTypes['OrganizationDataInput'];
export type IUpdateReportRequisitesInput = Zeus.ModelTypes['UpdateReportRequisitesInput'];
export type IReportType = Zeus.ModelTypes['ReportType'];
