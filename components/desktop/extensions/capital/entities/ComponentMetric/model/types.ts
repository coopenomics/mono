import type { Queries, Mutations, Zeus } from '@coopenomics/sdk';

export type IComponentMetric = Zeus.ModelTypes['CapitalComponentMetric'];

export type IGetComponentMetricsInput =
  Queries.Capital.GetComponentMetrics.IInput['data'];

export type IGetComponentMetricsOutput =
  Queries.Capital.GetComponentMetrics.IOutput[typeof Queries.Capital.GetComponentMetrics.name];

export type ICreateComponentMetricInput =
  Mutations.Capital.CreateComponentMetric.IInput['data'];

export type ICreateComponentMetricOutput =
  Mutations.Capital.CreateComponentMetric.IOutput[typeof Mutations.Capital.CreateComponentMetric.name];

export type IUpdateComponentMetricInput =
  Mutations.Capital.UpdateComponentMetric.IInput['data'];

export type IUpdateComponentMetricOutput =
  Mutations.Capital.UpdateComponentMetric.IOutput[typeof Mutations.Capital.UpdateComponentMetric.name];

export type IArchiveComponentMetricInput =
  Mutations.Capital.ArchiveComponentMetric.IInput['data'];

export type IArchiveComponentMetricOutput =
  Mutations.Capital.ArchiveComponentMetric.IOutput[typeof Mutations.Capital.ArchiveComponentMetric.name];

export type IGetIssueMetricBindingsInput =
  Queries.Capital.GetIssueMetricBindings.IInput['data'];

export type IGetIssueMetricBindingsOutput =
  Queries.Capital.GetIssueMetricBindings.IOutput[typeof Queries.Capital.GetIssueMetricBindings.name];

export type ISetIssueMetricBindingsInput =
  Mutations.Capital.SetIssueMetricBindings.IInput['data'];

export type ISetIssueMetricBindingsOutput =
  Mutations.Capital.SetIssueMetricBindings.IOutput[typeof Mutations.Capital.SetIssueMetricBindings.name];

export type IIssueMetricBinding = Zeus.ModelTypes['CapitalIssueMetricBinding'];

export type IGetMetricSeriesInput =
  Queries.Capital.GetMetricSeries.IInput['data'];

export type IGetMetricSeriesOutput =
  Queries.Capital.GetMetricSeries.IOutput[typeof Queries.Capital.GetMetricSeries.name];

export type IMetricSeries = Zeus.ModelTypes['CapitalMetricSeries'];

export type ILogMetricContributionInput =
  Mutations.Capital.LogMetricContribution.IInput['data'];

export type ILogMetricContributionOutput =
  Mutations.Capital.LogMetricContribution.IOutput[typeof Mutations.Capital.LogMetricContribution.name];
