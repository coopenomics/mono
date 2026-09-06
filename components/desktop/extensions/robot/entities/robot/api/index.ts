import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IRobotCouncil,
  IRobotDecision,
  IRobotDecisionType,
  IRobotDelegateKeyInput,
  IRobotJournal,
  IRobotJournalInput,
  IRobotKeyStatus,
  IRobotRetryDecisionInput,
} from '../model/types';

async function loadRegistry(): Promise<IRobotDecisionType[]> {
  const { [Queries.SovietRobot.GetRegistry.name]: result } = await client.Query(Queries.SovietRobot.GetRegistry.query);
  return result;
}

async function loadCouncil(): Promise<IRobotCouncil> {
  const { [Queries.SovietRobot.GetCouncil.name]: result } = await client.Query(Queries.SovietRobot.GetCouncil.query);
  return result;
}

async function loadKeyStatus(): Promise<IRobotKeyStatus> {
  const { [Queries.SovietRobot.GetKeyStatus.name]: result } = await client.Query(Queries.SovietRobot.GetKeyStatus.query);
  return result;
}

async function loadKeys(): Promise<IRobotKeyStatus[]> {
  const { [Queries.SovietRobot.GetKeys.name]: result } = await client.Query(Queries.SovietRobot.GetKeys.query);
  return result;
}

async function loadJournal(data: IRobotJournalInput): Promise<IRobotJournal> {
  const { [Queries.SovietRobot.GetJournal.name]: result } = await client.Query(Queries.SovietRobot.GetJournal.query, {
    variables: data,
  });
  return result;
}

async function delegateKey(data: IRobotDelegateKeyInput): Promise<IRobotKeyStatus> {
  const { [Mutations.SovietRobot.DelegateKey.name]: result } = await client.Mutation(Mutations.SovietRobot.DelegateKey.mutation, {
    variables: { data },
  });
  return result;
}

async function revokeKey(): Promise<boolean> {
  const { [Mutations.SovietRobot.RevokeKey.name]: result } = await client.Mutation(Mutations.SovietRobot.RevokeKey.mutation);
  return result;
}

async function retryDecision(data: IRobotRetryDecisionInput): Promise<IRobotDecision | null> {
  const { [Mutations.SovietRobot.RetryDecision.name]: result } = await client.Mutation(Mutations.SovietRobot.RetryDecision.mutation, {
    variables: { data },
  });
  // Поле необязательное в схеме, поэтому клиент отдаёт `undefined`, а наружу
  // мы обещаем `null`: у вызывающего одна проверка на пустоту, а не две.
  return result ?? null;
}

export const api = {
  loadRegistry,
  loadCouncil,
  loadKeyStatus,
  loadKeys,
  loadJournal,
  delegateKey,
  revokeKey,
  retryDecision,
};
