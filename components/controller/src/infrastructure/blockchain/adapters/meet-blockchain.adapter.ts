import { Injectable } from '@nestjs/common';
import { MeetBlockchainPort } from '~/domain/meet/ports/meet-blockchain.port';
import { BlockchainService } from '../blockchain.service';
import { MeetContract } from 'cooptypes';
import { Checksum256, TransactResult } from '@wharfkit/session';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Inject } from '@nestjs/common';
import httpStatus from 'http-status';
import type { TransactionResult } from '~/domain/blockchain/types/transaction-result.type';
import { VoteOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/vote-on-annual-general-meet-input.interface';
import { RestartAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/restart-annual-general-meet-input-domain.interface';
import { CreateAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/create-annual-meet-input-domain.interface';
import { GetMeetInputDomainInterface } from '~/domain/meet/interfaces/get-meet-input-domain.interface';
import { GetMeetsInputDomainInterface } from '~/domain/meet/interfaces/get-meets-input-domain.interface';
import { MeetProcessingDomainEntity } from '~/domain/meet/entities/meet-processing-domain.entity';
import { MeetRowProcessingDomainInterface } from '~/domain/meet/interfaces/meet-row-processing-domain.interface';
import { QuestionRowProcessingDomainInterface } from '~/domain/meet/interfaces/question-row-processing-domain.interface';
import { SignBySecretaryOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/sign-by-secretary-on-annual-general-meet-input-domain.interface';
import { SignByPresiderOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/sign-by-presider-on-annual-general-meet-input-domain.interface';
import { NotifyOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/notify-on-annual-general-meet-input-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { DomainToBlockchainUtils, HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class MeetBlockchainAdapter implements MeetBlockchainPort {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService
  ) {}

  async getMeet(data: GetMeetInputDomainInterface): Promise<MeetProcessingDomainEntity | null> {
    const { coopname, hash, username } = data;

    const meetData = await this.blockchainService.getSingleRow(
      MeetContract.contractName.production,
      coopname,
      MeetContract.Tables.Meets.tableName,
      Checksum256.from(hash),
      'secondary',
      'sha256'
    );

    if (!meetData) {
      return null;
    }

    // Получаем вопросы повестки
    const questions = await this.getQuestions({ coopname, meetId: meetData.id });

    // Создаем данные для доменной модели
    const processingData = new MeetProcessingDomainEntity(
      {
        hash: meetData.hash,
        meet: await this.convertBlockchainMeetToDomainMeet(meetData),
        questions: questions.map((q) => this.convertBlockchainQuestionToDomainQuestion(q)),
      },
      username
    );

    return processingData;
  }

  async getMeets(data: GetMeetsInputDomainInterface): Promise<MeetProcessingDomainEntity[]> {
    const { coopname, username } = data;
    const meetsData = await this.blockchainService.getAllRows(
      MeetContract.contractName.production,
      coopname,
      MeetContract.Tables.Meets.tableName
    );

    if (!meetsData || meetsData.length === 0) {
      return [];
    }

    // Преобразуем данные в домен
    const meetsProcessing = await Promise.all(
      meetsData.map(async (meetData) => {
        // Получаем вопросы повестки для каждого собрания
        const questions = await this.getQuestions({ coopname, meetId: meetData.id });

        // Создаем данные для доменной модели
        const processingData = new MeetProcessingDomainEntity(
          {
            hash: meetData.hash,
            meet: await this.convertBlockchainMeetToDomainMeet(meetData),
            questions: questions.map((q) => this.convertBlockchainQuestionToDomainQuestion(q)),
          },
          username
        );

        return processingData;
      })
    );

    return meetsProcessing;
  }

  async getQuestions(data: { coopname: string; meetId: string }): Promise<MeetContract.Tables.Questions.IOutput[]> {
    const { coopname, meetId } = data;
    const allQuestions = await this.blockchainService.query(
      MeetContract.contractName.production,
      coopname,
      MeetContract.Tables.Questions.tableName,
      {
        indexPosition: 'secondary',
        from: meetId,
        to: meetId,
      }
    );
    return allQuestions;
  }

  // Вспомогательный метод для преобразования данных встречи
  private async convertBlockchainMeetToDomainMeet(
    meetData: MeetContract.Tables.Meets.IOutput
  ): Promise<MeetRowProcessingDomainInterface> {
    // Преобразуем документы без проверки на пустой хеш - проверка будет в DocumentAggregationService
    const proposal = DomainToBlockchainUtils.convertChainDocumentToSignedDocument2(meetData.proposal);
    const authorization = meetData.authorization
      ? DomainToBlockchainUtils.convertChainDocumentToSignedDocument2(meetData.authorization)
      : undefined;
    const decision1 = meetData.decision1
      ? DomainToBlockchainUtils.convertChainDocumentToSignedDocument2(meetData.decision1)
      : undefined;
    const decision2 = meetData.decision2
      ? DomainToBlockchainUtils.convertChainDocumentToSignedDocument2(meetData.decision2)
      : undefined;

    return {
      id: Number(meetData.id),
      hash: meetData.hash,
      coopname: meetData.coopname,
      type: meetData.type,
      initiator: meetData.initiator,
      presider: meetData.presider,
      secretary: meetData.secretary,
      status: meetData.status,
      created_at: new Date(meetData.created_at),
      open_at: new Date(meetData.open_at),
      close_at: new Date(meetData.close_at),
      quorum_percent: Number(meetData.quorum_percent),
      signed_ballots: Number(meetData.signed_ballots),
      current_quorum_percent: Number(meetData.current_quorum_percent),
      level: meetData.level,
      cycle: Number(meetData.cycle),
      quorum_passed: meetData.quorum_passed,
      proposal: proposal,
      authorization: authorization,
      decision1: decision1,
      decision2: decision2,
      notified_users: meetData.notified_users,
    };
  }

  // Вспомогательный метод для преобразования данных вопроса
  private convertBlockchainQuestionToDomainQuestion(
    questionData: MeetContract.Tables.Questions.IOutput
  ): QuestionRowProcessingDomainInterface {
    return {
      id: Number(questionData.id),
      number: Number(questionData.number),
      meet_id: Number(questionData.meet_id),
      coopname: questionData.coopname,
      title: questionData.title,
      context: questionData.context,
      decision: questionData.decision,
      counter_votes_for: Number(questionData.counter_votes_for),
      counter_votes_against: Number(questionData.counter_votes_against),
      counter_votes_abstained: Number(questionData.counter_votes_abstained),
      voters_for: questionData.voters_for,
      voters_against: questionData.voters_against,
      voters_abstained: questionData.voters_abstained,
    };
  }

  async createMeet(data: CreateAnnualGeneralMeetInputDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    const { details: _details, ...meetPayload } = data;

    // Преобразуем доменный объект в инфраструктурный тип (поле details только в PG, не в цепи)
    const blockchainData: MeetContract.Actions.CreateMeet.IInput = {
      ...meetPayload,
      hash: data.hash || generateUniqueHash(),
      proposal: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.proposal),
      open_at: this.domainToBlockchainUtils.convertDateToBlockchainFormat(data.open_at),
      close_at: this.domainToBlockchainUtils.convertDateToBlockchainFormat(data.close_at),
    };

    const result = (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.CreateMeet.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return result;
  }

  async vote(data: VoteOnAnnualGeneralMeetInputDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем доменный объект в инфраструктурный тип
    const blockchainData: MeetContract.Actions.Vote.IInput = {
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
      ballot: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.ballot),
      votes: data.votes,
    };

    const result = (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.Vote.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return result;
  }

  async restartMeet(data: RestartAnnualGeneralMeetInputDomainInterface): Promise<string> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Генерируем новый уникальный хэш для собрания
    const new_hash = generateUniqueHash();

    // Преобразуем доменный объект в инфраструктурный тип
    const blockchainData: MeetContract.Actions.RestartMeet.IInput = {
      coopname: data.coopname,
      hash: data.hash,
      new_hash, // Используем сгенерированный новый хэш
      newproposal: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.newproposal),
      new_open_at: this.domainToBlockchainUtils.convertDateToBlockchainFormat(data.new_open_at),
      new_close_at: this.domainToBlockchainUtils.convertDateToBlockchainFormat(data.new_close_at),
    };

    (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.RestartMeet.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return new_hash;
  }

  async signBySecretaryOnAnnualGeneralMeet(
    data: SignBySecretaryOnAnnualGeneralMeetInputDomainInterface
  ): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    const blockchainData: MeetContract.Actions.SignBySecretary.IInput = {
      coopname: data.coopname,
      username: data.username,
      hash: data.hash,
      secretary_decision: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.secretary_decision),
    };

    const result = (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.SignBySecretary.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return result;
  }

  async signByPresiderOnAnnualGeneralMeet(
    data: SignByPresiderOnAnnualGeneralMeetInputDomainInterface
  ): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    const blockchainData: MeetContract.Actions.SignByPresider.IInput = {
      coopname: data.coopname,
      username: data.username,
      hash: data.hash,
      presider_decision: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.presider_decision),
    };

    const result = (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.SignByPresider.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return result;
  }

  async notifyOnAnnualGeneralMeet(data: NotifyOnAnnualGeneralMeetInputDomainInterface): Promise<TransactionResult> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new HttpApiError(httpStatus.BAD_GATEWAY, 'Не найден приватный ключ для совершения операции');

    this.blockchainService.initialize(data.coopname, wif);

    // Преобразуем доменный объект в инфраструктурный тип
    const blockchainData: MeetContract.Actions.GmNotify.IInput = {
      coopname: data.coopname,
      hash: data.meet_hash,
      username: data.username,
      notification: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.notification),
    };

    const result = (await this.blockchainService.transact({
      account: MeetContract.contractName.production,
      name: MeetContract.Actions.GmNotify.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: blockchainData,
    })) as TransactResult;

    return result;
  }
}
