import { ForbiddenException, Inject, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ExtensionAccessGuard,
  loadExtensionConfig,
  type ExtensionIdentity,
} from '@coopenomics/extension-sdk';
import {
  CHAIN_PORT,
  COOPERATIVE_VARS_PORT,
  DOCUMENT_PORT,
  type IChainPort,
  type ICooperativeVarsPort,
  type IDocumentPort,
} from '@coopenomics/innercoop';
import { CurrentIdentity } from './current-identity.decorator';
import {
  ExampleAppCooperative,
  ExampleAppDraftDocument,
  ExampleAppSignProbe,
} from './core-demo.types';

/**
 * Действие цепи для пробы подписи. Заявлено в манифесте пакета
 * (`coopenomics.chainActions`); другое действие ядро отклонит.
 */
const PROBE_ACTION = { account: 'eosio', name: 'refund' } as const;

/**
 * Работа с ядром по сети — образец для вынесенного приложения.
 *
 * Порты инжектятся так же, как в расширении внутри монолита:
 * `@Inject(DOCUMENT_PORT)`. Отличие одно — за токеном стоит не объект ядра, а
 * сетевой вызов (`ExtensionPortsModule`). Ключа кооператива и секрета ядра у
 * приложения нет: пайщика опознаёт ядро, действия цепи подписывает ядро.
 */
@Resolver()
export class CoreDemoResolver {
  private readonly coopname = loadExtensionConfig().coopname;

  constructor(
    @Inject(COOPERATIVE_VARS_PORT) private readonly vars: ICooperativeVarsPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
  ) {}

  @Query(() => ExampleAppCooperative, {
    name: 'exampleAppCooperative',
    nullable: true,
    description:
      'Реквизиты кооператива узла — чтение у ядра портом cooperativeVars',
  })
  async cooperative(): Promise<ExampleAppCooperative | null> {
    return this.vars.get();
  }

  @Mutation(() => ExampleAppDraftDocument, {
    name: 'exampleAppDraftDocument',
    description: 'Документ на подпись пайщику: формирует ядро портом document',
  })
  @UseGuards(ExtensionAccessGuard)
  async draftDocument(
    @CurrentIdentity() identity: ExtensionIdentity,
    @Args('registryId', {
      type: () => Int,
      defaultValue: 1,
      description: 'Номер шаблона в реестре документов',
    })
    registryId: number,
  ): Promise<ExampleAppDraftDocument> {
    const doc = await this.documents.generate({
      data: {
        registry_id: registryId,
        coopname: this.coopname,
        username: identity.username,
      },
      // Документ сохраняется в ядре: стол берёт его текст у ядра по хэшу,
      // когда показывает пайщику окно подписи.
      options: { skip_save: false },
    });
    return {
      fullTitle: doc.full_title,
      hash: doc.hash,
      html: doc.html,
      pdfBytes: Buffer.from(doc.binary, 'base64').length,
    };
  }

  @Mutation(() => ExampleAppSignProbe, {
    name: 'exampleAppSignProbe',
    description:
      'Проба подписи: ядро подписывает заявленное действие цепи своим ключом, в цепь транзакция не отправляется',
  })
  @UseGuards(ExtensionAccessGuard)
  async signProbe(
    @CurrentIdentity() identity: ExtensionIdentity,
  ): Promise<ExampleAppSignProbe> {
    if (identity.role !== 'chairman')
      throw new ForbiddenException('Пробу подписи запускает председатель');
    // broadcast=false: транзакция подписана и возвращена, состояние цепи не меняется.
    const result = await this.chain.transact(
      { ...PROBE_ACTION, authorization: [], data: { owner: this.coopname } },
      false,
    );
    const signatures = (result as { signatures?: unknown[] }).signatures;
    return {
      action: `${PROBE_ACTION.account}::${PROBE_ACTION.name}`,
      signatures: Array.isArray(signatures) ? signatures.length : 0,
      broadcast: false,
    };
  }
}
