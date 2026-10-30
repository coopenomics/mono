import { Injectable } from '@nestjs/common';
import { FreeDecisionInteractor } from '~/application/free-decision/interactors/free-decision.interactor';
import { Cooperative } from 'cooptypes';
import { Registry } from '@coopenomics/docs-templates';
import { ProjectFreeDecisionDomainEntity } from '~/domain/branch/entities/project-free-decision.entity';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { PublishProjectFreeDecisionInputDomainInterface } from '~/domain/free-decision/interfaces/publish-project-free-decision.interface';
import { IFreeDecisionPort, FREE_DECISION_PORT } from '@coopenomics/innercoop';

@Injectable()
export class FreeDecisionAdapter implements IFreeDecisionPort {
  constructor(private readonly freeDecisionInteractor: FreeDecisionInteractor) {}

  async createProjectOfFreeDecision(data: Cooperative.Document.IProjectData): Promise<ProjectFreeDecisionDomainEntity> {
    return this.freeDecisionInteractor.createProjectOfFreeDecision(data);
  }

  async generateProjectOfFreeDecisionDocument(
    data: Registry.ProjectFreeDecision.Action,
    options?: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    return this.freeDecisionInteractor.generateProjectOfFreeDecisionDocument(data, options);
  }

  async generateFreeDecisionDocument(
    data: Registry.FreeDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    return this.freeDecisionInteractor.generateFreeDecisionDocument(data, options);
  }

  async publishProjectOfFreeDecision(data: PublishProjectFreeDecisionInputDomainInterface): Promise<boolean> {
    return this.freeDecisionInteractor.publishProjectOfFreeDecision(data);
  }
}
