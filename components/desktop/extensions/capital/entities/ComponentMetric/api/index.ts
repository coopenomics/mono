import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IComponentMetric,
  IGetComponentMetricsInput,
  ICreateComponentMetricInput,
  ICreateComponentMetricOutput,
  IUpdateComponentMetricInput,
  IUpdateComponentMetricOutput,
  IArchiveComponentMetricInput,
  IArchiveComponentMetricOutput,
  IGetIssueMetricBindingsInput,
  IGetIssueMetricBindingsOutput,
  ISetIssueMetricBindingsInput,
  ISetIssueMetricBindingsOutput,
  IGetMetricSeriesInput,
  IGetMetricSeriesOutput,
  ILogMetricContributionInput,
  ILogMetricContributionOutput,
  IGetMetricWaveInput,
  IGetMetricWaveOutput,
  IGetMetricSuperpositionInput,
  IGetMetricSuperpositionOutput,
} from '../model';

async function getComponentMetrics(
  data: IGetComponentMetricsInput,
): Promise<IComponentMetric[]> {
  const { [Queries.Capital.GetComponentMetrics.name]: result } =
    await client.Query(Queries.Capital.GetComponentMetrics.query, {
      variables: { data },
    });
  return result as IComponentMetric[];
}

async function createComponentMetric(
  data: ICreateComponentMetricInput,
): Promise<ICreateComponentMetricOutput> {
  const { [Mutations.Capital.CreateComponentMetric.name]: result } =
    await client.Mutation(Mutations.Capital.CreateComponentMetric.mutation, {
      variables: { data },
    });
  return result;
}

async function updateComponentMetric(
  data: IUpdateComponentMetricInput,
): Promise<IUpdateComponentMetricOutput> {
  const { [Mutations.Capital.UpdateComponentMetric.name]: result } =
    await client.Mutation(Mutations.Capital.UpdateComponentMetric.mutation, {
      variables: { data },
    });
  return result;
}

async function archiveComponentMetric(
  data: IArchiveComponentMetricInput,
): Promise<IArchiveComponentMetricOutput> {
  const { [Mutations.Capital.ArchiveComponentMetric.name]: result } =
    await client.Mutation(Mutations.Capital.ArchiveComponentMetric.mutation, {
      variables: { data },
    });
  return result;
}

async function getIssueMetricBindings(
  data: IGetIssueMetricBindingsInput,
): Promise<IGetIssueMetricBindingsOutput> {
  const { [Queries.Capital.GetIssueMetricBindings.name]: result } =
    await client.Query(Queries.Capital.GetIssueMetricBindings.query, {
      variables: { data },
    });
  return result;
}

async function setIssueMetricBindings(
  data: ISetIssueMetricBindingsInput,
): Promise<ISetIssueMetricBindingsOutput> {
  const { [Mutations.Capital.SetIssueMetricBindings.name]: result } =
    await client.Mutation(Mutations.Capital.SetIssueMetricBindings.mutation, {
      variables: { data },
    });
  return result;
}

async function getMetricSeries(
  data: IGetMetricSeriesInput,
): Promise<IGetMetricSeriesOutput> {
  const { [Queries.Capital.GetMetricSeries.name]: result } =
    await client.Query(Queries.Capital.GetMetricSeries.query, {
      variables: { data },
    });
  return result;
}

async function logMetricContribution(
  data: ILogMetricContributionInput,
): Promise<ILogMetricContributionOutput> {
  const { [Mutations.Capital.LogMetricContribution.name]: result } =
    await client.Mutation(Mutations.Capital.LogMetricContribution.mutation, {
      variables: { data },
    });
  return result;
}

async function getMetricWave(
  data: IGetMetricWaveInput,
): Promise<IGetMetricWaveOutput> {
  const { [Queries.Capital.GetMetricWave.name]: result } =
    await client.Query(Queries.Capital.GetMetricWave.query, {
      variables: { data },
    });
  return result;
}

async function getMetricSuperposition(
  data: IGetMetricSuperpositionInput,
): Promise<IGetMetricSuperpositionOutput> {
  const { [Queries.Capital.GetMetricSuperposition.name]: result } =
    await client.Query(Queries.Capital.GetMetricSuperposition.query, {
      variables: { data },
    });
  return result;
}

export const api = {
  getComponentMetrics,
  createComponentMetric,
  updateComponentMetric,
  archiveComponentMetric,
  getIssueMetricBindings,
  setIssueMetricBindings,
  getMetricSeries,
  logMetricContribution,
  getMetricWave,
  getMetricSuperposition,
};
