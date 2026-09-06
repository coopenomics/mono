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
import { createEmptyDocument } from '../../../../shared/utils/document-utils';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';

export const MARKETPLACE_CONVERT_SERVICE = Symbol('MARKETPLACE_CONVERT_SERVICE');

/** Членский кошелёк пайщика в ЦПП «Стол заказов» (USER_SHARED, счёт 86). */
export const MARKETPLACE_MEMBER_WALLET = 'w.mkt.member';
/** Главный паевой кошелёк ЦК — источник конвертации при обычном заказе. */
export const MAIN_SHARE_WALLET = 'w.wal.share';
/** Свободный паевой «Стола заказов» — источник при заказе из остатка и довзносе по факту. */
export const MARKETPLACE_SHARE_WALLET = 'w.mkt.share';

export type ConvertStatementDocument = MarketContract.Actions.CreateOrder.ICreateOrder['convert_statement'];

/** Строка плана конвертации: полный взнос и недостающая часть, в минимальных единицах. */
export interface MarketplaceConvertPlanLine {
  fee_units: bigint;
  convert_units: bigint;
}

/**
 * Заявление 1110 о переводе паевого взноса в ЦПП «Стол заказов» с уплатой
 * членского взноса (паевая модель, компонент 68). Текст — на полную сумму
 * заказа с выделением взноса участка; по кошелькам обе части идут каждая
 * своим путём: паевая — по паевым кошелькам, членская — по членским: взнос
 * под заказ берётся с членского кошелька программы `w.mkt.member`,
 * недостающая до взноса часть конвертируется из паевого, остаток кошелька
 * зачитывается автоматически. Контракт считает недостачу сам по балансу на
 * момент действия — здесь тот же расчёт для превью и проверки подписанных
 * мет, чтобы суммы совпали побитово.
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

  /** Остаток членского кошелька программы — зачитывается в счёт взноса автоматически. */
  memberAvailableUnits(coopname: string, username: string): Promise<bigint> {
    return this.availableUnits(coopname, username, MARKETPLACE_MEMBER_WALLET);
  }

  /**
   * План конвертации по строкам в порядке проведения: каждая строка сначала
   * забирает остаток членского кошелька, недостающее — конвертация по
   * заявлению. Порядок обязан совпадать с порядком отправки в цепь.
   */
  planConversions(memberAvailableUnits: bigint, feeUnits: ReadonlyArray<bigint>): MarketplaceConvertPlanLine[] {
    let available = memberAvailableUnits > 0n ? memberAvailableUnits : 0n;
    return feeUnits.map((fee_units) => {
      const convert_units = fee_units > available ? fee_units - available : 0n;
      available = available + convert_units - fee_units;
      return { fee_units, convert_units };
    });
  }

  /** Недостающая до одной суммы часть членского кошелька (довзнос по факту, одна строка). */
  shortfallUnits(memberAvailableUnits: bigint, feeUnits: bigint): bigint {
    return this.planConversions(memberAvailableUnits, [feeUnits])[0]!.convert_units;
  }

  /**
   * Заявление 1110 к подписи: полная сумма перевода в программу (тело +
   * взнос), членский взнос в её составе и часть взноса, которая по этому
   * заявлению переходит из паевого в членский (остальное — зачёт кошелька).
   */
  async generateStatement(input: {
    coopname: string;
    username: string;
    order_hash: string;
    /** Тело заказа (стоимость имущества) в минимальных единицах. */
    body_units: bigint;
    /** Членский взнос участка в минимальных единицах. */
    fee_units: bigint;
    /** Недостающая до взноса часть — переводится из паевого в членский. */
    convert_units: bigint;
    fee_contract_percent: number;
    /** wallet — с Цифрового кошелька (обычный заказ), market — со свободного паевого программы. */
    source: 'wallet' | 'market';
  }): Promise<InnerGeneratedDocument> {
    const credited = input.fee_units - input.convert_units;
    const action: Cooperative.Registry.MarketplaceConvertStatement.Action & { credited_amount?: string } = {
      registry_id: Cooperative.Registry.MarketplaceConvertStatement.registry_id,
      coopname: input.coopname,
      username: input.username,
      lang: 'ru',
      order_hash: input.order_hash,
      amount: this.economyService.unitsToAsset(input.body_units + input.fee_units),
      membership_fee: this.economyService.unitsToAsset(input.fee_units),
      convert_amount: this.economyService.unitsToAsset(input.convert_units),
      fee_percent: this.economyService.toHumanFeePercent(input.fee_contract_percent),
      source: input.source,
      ...(credited > 0n ? { credited_amount: this.economyService.unitsToAsset(credited) } : {}),
      // Тело сохраняется в стор: реестр документов пересобирает агрегат по doc_hash.
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  /**
   * Проверка подписанного заявления перед отправкой в цепь: тот же заказ,
   * та же сумма (баланс членского кошелька мог измениться с превью),
   * подпись пайщика верна. Возвращает document2 для контракта.
   */
  verifySigned(
    signed: MarketplaceConvertStatementSignedInputDTO | null | undefined,
    expected: { order_hash: string; body_units: bigint; fee_units: bigint; convert_units: bigint },
    signer: string
  ): ConvertStatementDocument {
    if (!signed) {
      throw new BadRequestException(
        `Нет подписанного заявления о переводе паевого взноса в программу на ${this.economyService.unitsToAsset(expected.body_units + expected.fee_units)} — обновите оформление.`
      );
    }
    const meta = signed.meta;
    if (
      meta.registry_id !== Cooperative.Registry.MarketplaceConvertStatement.registry_id ||
      meta.order_hash !== expected.order_hash
    ) {
      throw new BadRequestException('Заявление подписано для другого заказа — обновите оформление.');
    }
    const expectedTotal = expected.body_units + expected.fee_units;
    if (this.economyService.assetToUnits(String(meta.amount)) !== expectedTotal) {
      throw new BadRequestException(
        `Сумма позиции изменилась (в заявлении ${meta.amount}, к оплате ${this.economyService.unitsToAsset(expectedTotal)}) — обновите оформление.`
      );
    }
    if (this.economyService.assetToUnits(String(meta.membership_fee)) !== expected.fee_units) {
      throw new BadRequestException(
        `Членский взнос изменился (в заявлении ${meta.membership_fee}, по ставке ${this.economyService.unitsToAsset(expected.fee_units)}) — обновите оформление.`
      );
    }
    if (this.economyService.assetToUnits(String(meta.convert_amount)) !== expected.convert_units) {
      throw new BadRequestException(
        `Сумма перевода в членский изменилась (в заявлении ${meta.convert_amount}, к переводу ${this.economyService.unitsToAsset(expected.convert_units)}) — обновите оформление.`
      );
    }
    this.verifySignature(signed, signer);
    return new SignedDigitalDocumentInputDTO(signed).toDocument() as ConvertStatementDocument;
  }

  /** Пустой document2 — когда взнос покрыт остатком членского кошелька и заявление не нужно. */
  emptyDocument(): ConvertStatementDocument {
    return createEmptyDocument() as ConvertStatementDocument;
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
