import { Cooperative } from 'cooptypes';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import type { PublishProjectFreeDecisionInputDomainInterface } from '~/domain/free-decision/interfaces/publish-project-free-decision.interface';
import config from '~/config/config';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import {
  PROJECT_FREE_DECISION_REPOSITORY,
  ProjectFreeDecisionRepository,
} from '~/domain/common/repositories/project-free-decision.repository';
import { ProjectFreeDecisionDomainEntity } from '~/domain/branch/entities/project-free-decision.entity';

@Injectable()
export class FreeDecisionInteractor {
  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(PROJECT_FREE_DECISION_REPOSITORY) private readonly projectDecisionRepository: ProjectFreeDecisionRepository,
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly SovietBlockchainPort: SovietBlockchainPort
  ) {}

  async createProjectOfFreeDecision(data: Cooperative.Document.IProjectData): Promise<ProjectFreeDecisionDomainEntity> {
    await this.projectDecisionRepository.create(data);
    return new ProjectFreeDecisionDomainEntity(data);
  }

  async generateProjectOfFreeDecisionDocument(
    data: Cooperative.Registry.ProjectFreeDecision.Action,
    options?: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ProjectFreeDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateFreeDecisionDocument(
    data: Cooperative.Registry.FreeDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.FreeDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async publishProjectOfFreeDecision(data: PublishProjectFreeDecisionInputDomainInterface): Promise<boolean> {
    const document = await this.documentDomainService.getDocumentByHash(data.document.doc_hash);

    if (!document) throw DomainError.badRequest('DOCUMENT_NOT_FOUND');

    if (data.document.meta.registry_id != Cooperative.Registry.ProjectFreeDecision.registry_id)
      throw DomainError.badRequest('FREE_DECISION_WRONG_REGISTRY', {
        expected: Cooperative.Registry.ProjectFreeDecision.registry_id,
      });

    if (data.coopname != config.coopname)
      throw DomainError.badRequest('COOPERATIVE_NOT_SERVED');

    await this.SovietBlockchainPort.publishProjectOfFreeDecision({
      coopname: data.coopname,
      username: data.username,
      meta: data.meta,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });

    return true;
  }
}
