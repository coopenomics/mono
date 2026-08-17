import { Injectable } from '@nestjs/common';
import { BranchDTO } from '../dto/branch.dto';
import type { GetBranchesGraphQLInput } from '../dto/get-branches-input.dto';
import { BranchInteractor } from '../use-cases/branch.interactor';
import type { EditBranchGraphQLInput } from '../dto/edit-branch-input.dto';
import type { CreateBranchGraphQLInput } from '../dto/create-branch-input.dto';
import type { DeleteBranchGraphQLInput } from '../dto/delete-branch-input.dto';
import type { AddTrustedAccountGraphQLInput } from '../dto/add-trusted-account-input.dto';
import type { DeleteTrustedAccountGraphQLInput } from '../dto/delete-trusted-account-input.dto';
import type { SetBranchPrivateGraphQLInput } from '../dto/set-branch-private-input.dto';
import type { AddBranchWhitelistGraphQLInput } from '../dto/add-branch-whitelist-input.dto';
import type { DeleteBranchWhitelistGraphQLInput } from '../dto/delete-branch-whitelist-input.dto';
import type { SelectBranchInputDTO } from '../dto/select-branch-input.dto';
import type { GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import type { SelectBranchGenerateDocumentInputDTO } from '../../document/documents-dto/select-branch-document.dto';
@Injectable()
export class BranchService {
  constructor(private readonly branchInteractor: BranchInteractor) {}

  public async getBranches(data: GetBranchesGraphQLInput, currentUsername?: string): Promise<BranchDTO[]> {
    const branches = await this.branchInteractor.getBranches(data, currentUsername);

    const result: BranchDTO[] = [];

    // Преобразуем в DTO
    for (const branch of branches) {
      result.push(new BranchDTO(branch));
    }

    return result;
  }

  public async createBranch(data: CreateBranchGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.createBranch(data);

    return new BranchDTO(branch);
  }

  public async editBranch(data: EditBranchGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.editBranch(data);
    return new BranchDTO(branch);
  }

  public async deleteBranch(data: DeleteBranchGraphQLInput): Promise<boolean> {
    const deleted = await this.branchInteractor.deleteBranch(data);

    return deleted;
  }

  public async addTrustedAccount(data: AddTrustedAccountGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.addTrustedAccount(data);
    return new BranchDTO(branch);
  }

  public async deleteTrustedAccount(data: DeleteTrustedAccountGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.deleteTrustedAccount(data);
    return new BranchDTO(branch);
  }

  public async setBranchPrivate(data: SetBranchPrivateGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.setBranchPrivate(data);
    return new BranchDTO(branch);
  }

  public async addBranchWhitelist(data: AddBranchWhitelistGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.addBranchWhitelist(data);
    return new BranchDTO(branch);
  }

  public async deleteBranchWhitelist(data: DeleteBranchWhitelistGraphQLInput): Promise<BranchDTO> {
    const branch = await this.branchInteractor.deleteBranchWhitelist(data);
    return new BranchDTO(branch);
  }

  public async selectBranch(data: SelectBranchInputDTO, currentUsername?: string): Promise<boolean> {
    const selected = await this.branchInteractor.selectBranch(data, currentUsername);
    return selected;
  }

  public async generateSelectBranchDocument(
    data: SelectBranchGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.branchInteractor.generateSelectBranchDocument(data, options);
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }
}
