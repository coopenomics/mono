import { BranchContract, SovietContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';

export interface BranchBlockchainPort {
  createBranch(data: BranchContract.Actions.CreateBranch.ICreateBranch): Promise<TransactResult>;
  editBranch(data: BranchContract.Actions.EditBranch.IEditBranch): Promise<TransactResult>;
  getBranches(coopname: string): Promise<BranchContract.Tables.Branches.IBranch[]>;
  getBranch(coopname: string, braname: string): Promise<BranchContract.Tables.Branches.IBranch | null>;
  getParticipants(coopname: string): Promise<SovietContract.Tables.Participants.IParticipants[]>;
  deleteBranch(data: BranchContract.Actions.DeleteBranch.IDeleteBranch): Promise<TransactResult>;
  addTrustedAccount(data: BranchContract.Actions.AddTrusted.IAddTrusted): Promise<TransactResult>;
  deleteTrustedAccount(data: BranchContract.Actions.DeleteTrusted.IDeleteTrusted): Promise<TransactResult>;
  setBranchPrivate(data: BranchContract.Actions.SetPrivate.ISetPrivate): Promise<TransactResult>;
  addBranchWhitelist(data: BranchContract.Actions.AddWhite.IAddWhite): Promise<TransactResult>;
  deleteBranchWhitelist(data: BranchContract.Actions.DelWhite.IDelWhite): Promise<TransactResult>;
  selectBranch(data: SovietContract.Actions.Branches.SelectBranch.ISelectBranch): Promise<TransactResult>;
}

export const BRANCH_BLOCKCHAIN_PORT = Symbol('BranchBlockchainPort');
