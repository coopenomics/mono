import type { Queries, Mutations, Zeus } from '@coopenomics/sdk';

export type IComponentMetric = Zeus.ModelTypes['CapitalComponentMetric'];

export type IMeasure = Zeus.ModelTypes['CapitalMeasure'];

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

export type IGetMeasuresInput = Queries.Capital.GetMeasures.IInput['data'];

export type IGetMeasuresOutput =
  Queries.Capital.GetMeasures.IOutput[typeof Queries.Capital.GetMeasures.name];

export type ICreateMeasureInput = Mutations.Capital.CreateMeasure.IInput['data'];

export type ICreateMeasureOutput =
  Mutations.Capital.CreateMeasure.IOutput[typeof Mutations.Capital.CreateMeasure.name];

export type IUpdateMeasureInput = Mutations.Capital.UpdateMeasure.IInput['data'];

export type IUpdateMeasureOutput =
  Mutations.Capital.UpdateMeasure.IOutput[typeof Mutations.Capital.UpdateMeasure.name];

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

export type IGetMetricWaveInput =
  Queries.Capital.GetMetricWave.IInput['data'];

export type IGetMetricWaveOutput =
  Queries.Capital.GetMetricWave.IOutput[typeof Queries.Capital.GetMetricWave.name];

export type IMetricWave = Zeus.ModelTypes['CapitalMetricWave'];

export type IGetMetricSuperpositionInput =
  Queries.Capital.GetMetricSuperposition.IInput['data'];

export type IGetMetricSuperpositionOutput =
  Queries.Capital.GetMetricSuperposition.IOutput[typeof Queries.Capital.GetMetricSuperposition.name];

export type IMetricSuperposition = Zeus.ModelTypes['CapitalMetricSuperposition'];

export type IGetMetricSuperpositionHistoryInput =
  Queries.Capital.GetMetricSuperpositionHistory.IInput['data'];

export type IGetMetricSuperpositionHistoryOutput =
  Queries.Capital.GetMetricSuperpositionHistory.IOutput[typeof Queries.Capital.GetMetricSuperpositionHistory.name];

export type IMetricSuperpositionHistory = Zeus.ModelTypes['CapitalMetricSuperpositionHistory'];

export type IMetricSuperpositionFrame = Zeus.ModelTypes['CapitalMetricSuperpositionFrame'];
