import type { Mutations, Queries } from '@coopenomics/sdk';

export type IRobotDecisionType = Queries.SovietRobot.GetRegistry.IOutput[typeof Queries.SovietRobot.GetRegistry.name][number];
export type IRobotCouncil = Queries.SovietRobot.GetCouncil.IOutput[typeof Queries.SovietRobot.GetCouncil.name];
export type IRobotKeyStatus = Queries.SovietRobot.GetKeyStatus.IOutput[typeof Queries.SovietRobot.GetKeyStatus.name];
export type IRobotJournalInput = Queries.SovietRobot.GetJournal.IInput;
export type IRobotJournal = Queries.SovietRobot.GetJournal.IOutput[typeof Queries.SovietRobot.GetJournal.name];
export type IRobotDecision = IRobotJournal['items'][number];
export type IRobotDelegateKeyInput = Mutations.SovietRobot.DelegateKey.IInput['data'];
export type IRobotRetryDecisionInput = Mutations.SovietRobot.RetryDecision.IInput['data'];
