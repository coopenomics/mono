import { Injectable } from '@nestjs/common';
import { GenerateDocumentOptionsInputDTO } from '@coopenomics/extension-kit';
import { PublishProjectFreeDecisionInputDTO } from '../dto/publish-project-free-decision-input.dto';
import type { CreateProjectFreeDecisionInputDTO } from '../dto/create-project-free-decision.dto';
import { CreatedProjectFreeDecisionDTO } from '../dto/created-project-free-decision.dto';
import { v4 } from 'uuid';
import type { FreeDecisionGenerateDocumentInputDTO } from '../../document/documents-dto/free-decision-document.dto';
import { FreeDecisionInteractor } from '~/application/free-decision/interactors/free-decision.interactor';
import type { ProjectFreeDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/project-free-decision-document.dto';
import type { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { AgendaService } from '~/application/agenda/services/agenda.service';
import type { AgendaWithDocumentsDTO } from '~/application/agenda/dto/agenda-with-documents.dto';


@Injectable()
export class FreeDecisionService {
  constructor(
    private readonly freeDecisionInteractor: FreeDecisionInteractor,
    private readonly agendaService: AgendaService
  ) {}

  public async generateProjectOfFreeDecision(
    data: ProjectFreeDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.freeDecisionInteractor.generateProjectOfFreeDecisionDocument(data, options);
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateFreeDecision(
    data: FreeDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.freeDecisionInteractor.generateFreeDecisionDocument(data, options);
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async publishProjectOfFreeDecision(
    data: PublishProjectFreeDecisionInputDTO
  ): Promise<AgendaWithDocumentsDTO | null> {
    await this.freeDecisionInteractor.publishProjectOfFreeDecision(data);

    // decision.hash в блокчейне == «общий хэш» подписанного заявления (hash =
    // doc_hash + meta_hash), НЕ doc_hash (хэш только содержимого) — их легко
    // перепутать, и матч по doc_hash молча никогда не сработает.
    const hash = data.document.hash;

    // Публикация вернулась после разбора своего блока: решение в цепи, действие
    // newsubmitted сохранено узлом — вопрос собирается одним чтением. null —
    // только если узел не дождался блока в пределе; стол догонит по ленте.
    return this.agendaService.getAgendaItemByHash(hash);
  }

  public async createProjectOfFreeDecision(data: CreateProjectFreeDecisionInputDTO): Promise<CreatedProjectFreeDecisionDTO> {
    const id = v4();
    const project = await this.freeDecisionInteractor.createProjectOfFreeDecision({ ...data, id });
    return new CreatedProjectFreeDecisionDTO(project);
  }
}
