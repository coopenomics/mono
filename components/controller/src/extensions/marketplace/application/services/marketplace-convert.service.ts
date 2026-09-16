import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Cooperative, type MarketContract } from 'cooptypes';
import { PublicKey, Signature } from '@wharfkit/antelope';
import {
  DOCUMENT_PORT,
  USER_WALLET_PORT,
  type IDocumentPort,
  type InnerGeneratedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';

export const MARKETPLACE_CONVERT_SERVICE = Symbol('MARKETPLACE_CONVERT_SERVICE');

/** Внутренний членский кошелёк пайщика в ЦПП «Стол заказов» (USER_SHARED, счёт 86). */
export const MARKETPLACE_MEMBER_WALLET = 'w.mkt.member';
/** Главный паевой кошелёк ЦК — паевой источник обычного заказа. */
export const MAIN_SHARE_WALLET = 'w.wal.share';
/** Свободный паевой «Стола заказов» — паевой источник заказа из остатка и доплаты по факту. */
export const MARKETPLACE_SHARE_WALLET = 'w.mkt.share';

export type ConvertStatementDocument = MarketContract.Actions.Convert.IConvert['convert_statement'];

/** Строка к фондированию: тело и взнос участка в минимальных единицах. */
export interface FundingLineInput {
  body_units: bigint;
  fee_units: bigint;
}

/** Как контракт разложит строку: взнос с членского кошелька, тело со свободного паевого программы, недостающее — с Цифрового кошелька. */
export interface FundingLinePlan extends FundingLineInput {
  /** Часть взноса, покрытая остатком внутреннего членского кошелька. */
  fee_member_units: bigint;
  /** Недостающая на взнос часть — переводится в членский кошелёк действием convert. */
  fee_convert_units: bigint;
  /** Часть тела со свободного паевого «Стола заказов» (o.mkt.lockp). */
  body_program_units: bigint;
  /** Остаток тела с Цифрового кошелька (o.mkt.lock). */
  body_wallet_units: bigint;
}

export interface FundingPlan {
  lines: FundingLinePlan[];
  /** Сумма переводов в членский кошелёк (все строки) — параметр действия convert. */
  fee_convert_units: bigint;
  /** Тела с Цифрового кошелька (все строки). */
  body_wallet_units: bigint;
  /** Сумма заявления — всё, что уходит с Цифрового кошелька: тела сверх свободного паевого плюс недостающие взносы. */
  transfer_units: bigint;
}

/**
 * Заявление 1110 о переводе паевого взноса в ЦПП «Стол заказов» (паевая
 * модель, уточнения владельца 06–07.09.2026). Два кошелька программы
 * оплачивают каждый свою часть: свободный паевой `w.mkt.share` — тело заказа,
 * внутренний членский `w.mkt.member` — взнос участка (туда возвращаются
 * паевые и членские средства при отменах и гарантийных возвратах). Заявление
 * — «прошу перевести с баланса моего Цифрового кошелька на баланс ЦПП «Стол
 * заказов» N, из них членский взнос M» — пишется только на то, чего в них не
 * хватило: M — взнос минус остаток членского кошелька, N — тело сверх
 * свободного паевого плюс M. Отдельная транзакция `convert` до заказа
 * переводит M; паевая часть уходит своим путём при создании заказа. Контракт
 * раскладывает суммы сам по балансам на момент действия — здесь тот же
 * расчёт для превью и сверки подписанных мет.
 */
@Injectable()
export class MarketplaceConvertService {
  constructor(
    @Inject(USER_WALLET_PORT) private readonly walletRepo: IUserWalletPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService,
    @Inject(MARKETPLACE_ASSET_CONFIG) private readonly assetConfig: MarketplaceAssetConfig
  ) {}

  /** available кошелька пайщика в минимальных единицах валюты (нет строки — 0). */
  async availableUnits(coopname: string, username: string, wallet_name: string): Promise<bigint> {
    const rows = await this.walletRepo.findByUsername(coopname, username);
    const row = rows.find((r) => r.wallet_name === wallet_name);
    return row?.available ? this.economyService.assetToUnits(String(row.available)) : 0n;
  }

  /** Остаток внутреннего членского кошелька — покрывает взносы. */
  memberAvailableUnits(coopname: string, username: string): Promise<bigint> {
    return this.availableUnits(coopname, username, MARKETPLACE_MEMBER_WALLET);
  }

  /** Остаток свободного паевого «Стола заказов» — покрывает тела заказов. */
  programShareAvailableUnits(coopname: string, username: string): Promise<bigint> {
    return this.availableUnits(coopname, username, MARKETPLACE_SHARE_WALLET);
  }

  /** Оба остатка кошельков программы одним чтением. */
  async programBalances(coopname: string, username: string): Promise<{ member: bigint; share: bigint }> {
    const rows = await this.walletRepo.findByUsername(coopname, username);
    const pick = (name: string) => {
      const row = rows.find((r) => r.wallet_name === name);
      return row?.available ? this.economyService.assetToUnits(String(row.available)) : 0n;
    };
    return { member: pick(MARKETPLACE_MEMBER_WALLET), share: pick(MARKETPLACE_SHARE_WALLET) };
  }

  /**
   * План по строкам в порядке проведения (тот же, что в контракте): взнос
   * каждой строки покрывается остатком членского кошелька, тело — остатком
   * свободного паевого программы; нехватка каждой части — с Цифрового кошелька
   * по заявлению. Остатки тянутся между строками последовательно.
   */
  planFunding(
    balances: { member: bigint; share: bigint },
    lines: ReadonlyArray<FundingLineInput>
  ): FundingPlan {
    let member = balances.member > 0n ? balances.member : 0n;
    let share = balances.share > 0n ? balances.share : 0n;
    const planned: FundingLinePlan[] = lines.map((line) => {
      const fee_member_units = line.fee_units > member ? member : line.fee_units;
      member -= fee_member_units;
      const body_program_units = line.body_units > share ? share : line.body_units;
      share -= body_program_units;
      return {
        ...line,
        fee_member_units,
        fee_convert_units: line.fee_units - fee_member_units,
        body_program_units,
        body_wallet_units: line.body_units - body_program_units,
      };
    });
    const fee_convert_units = planned.reduce((s, l) => s + l.fee_convert_units, 0n);
    const body_wallet_units = planned.reduce((s, l) => s + l.body_wallet_units, 0n);
    return { lines: planned, fee_convert_units, body_wallet_units, transfer_units: body_wallet_units + fee_convert_units };
  }

  /** Недостающая на одну сумму часть членского кошелька (довзнос по факту). */
  shortfallUnits(memberAvailableUnits: bigint, feeUnits: bigint): bigint {
    return this.planFunding({ member: memberAvailableUnits, share: 0n }, [{ body_units: 0n, fee_units: feeUnits }]).fee_convert_units;
  }

  /** Заявление 1110 к подписи: сумма перевода (тело и недостающая часть взноса) и членская часть в ней. */
  async generateStatement(input: {
    coopname: string;
    username: string;
    /** Якорь: хеш оформления, бандла либо заказа. */
    anchor_hash: string;
    /** Сумма заявления — недостающая часть тела плюс недостающая часть взноса. */
    amount_units: bigint;
    /** Членская часть (взнос за вычетом остатка членского кошелька) — параметр действия convert. */
    fee_units: bigint;
  }): Promise<InnerGeneratedDocument> {
    const action: Cooperative.Registry.MarketplaceConvertStatement.Action = {
      registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
      coopname: input.coopname,
      username: input.username,
      lang: 'ru',
      order_hash: input.anchor_hash,
      amount: this.economyService.unitsToAsset(input.amount_units),
      membership_fee: this.economyService.unitsToAsset(input.fee_units),
      // Тело сохраняется в стор: реестр документов пересобирает агрегат по doc_hash.
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  /**
   * Проверка подписанного заявления перед отправкой в цепь: тот же якорь,
   * та же недостающая сумма и членская часть (баланс кошелька мог измениться
   * с превью), подпись пайщика верна. Возвращает document2 для контракта.
   */
  verifySigned(
    signed: MarketplaceConvertStatementSignedInputDTO | null | undefined,
    expected: { anchor_hash: string; amount_units: bigint; fee_units: bigint },
    signer: string
  ): ConvertStatementDocument {
    if (!signed) {
      throw new BadRequestException(
        `Нет подписанного заявления о переводе паевого взноса в программу на ${this.economyService.unitsToAsset(expected.amount_units)} — обновите оформление.`
      );
    }
    const meta = signed.meta;
    if (
      meta.registry_id !== Cooperative.Registry.MarketplaceConvertStatement.registry_id ||
      meta.order_hash !== expected.anchor_hash
    ) {
      throw new BadRequestException('Заявление подписано для другого оформления — обновите оформление.');
    }
    if (this.economyService.assetToUnits(String(meta.amount)) !== expected.amount_units) {
      throw new BadRequestException(
        `Недостающая сумма изменилась (в заявлении ${meta.amount}, к переводу ${this.economyService.unitsToAsset(expected.amount_units)}) — обновите оформление.`
      );
    }
    if (this.economyService.assetToUnits(String(meta.membership_fee)) !== expected.fee_units) {
      throw new BadRequestException(
        `Членская часть перевода изменилась (в заявлении ${meta.membership_fee}, к переводу ${this.economyService.unitsToAsset(expected.fee_units)}) — обновите оформление.`
      );
    }
    this.verifySignature(signed, signer);
    return new SignedDigitalDocumentInputDTO(signed).toDocument() as ConvertStatementDocument;
  }

  private verifySignature(
    doc: { signatures: Array<{ signer: string; public_key: string; signature: string; signed_hash: string }> },
    expectedSigner: string
  ): void {
    const signatures = doc.signatures ?? [];
    if (!signatures.some((s) => s.signer === expectedSigner)) {
      throw new ForbiddenException(`Заявление должно быть подписано учётной записью ${expectedSigner}.`);
    }
    for (const sig of signatures) {
      let ok = false;
      try {
        ok = Signature.from(sig.signature).verifyDigest(sig.signed_hash, PublicKey.from(sig.public_key));
      } catch {
        ok = false;
      }
      if (!ok) {
        throw new ForbiddenException('Подпись заявления недействительна.');
      }
    }
  }
}
