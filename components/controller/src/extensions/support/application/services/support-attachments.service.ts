import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { InnerFileStorageBucket } from '@coopenomics/innercoop';
import { InjectBucket, UseBucket, platformSettings } from '@coopenomics/extension-kit';
import {
  SUPPORT_TICKET_ATTACHMENT_REPOSITORY,
  type SupportTicketAttachmentRepository,
} from '../../domain/repositories/support-ticket-attachment.repository';
import type { SupportAttachmentDraft } from '../../domain/repositories/support-ticket.repository';
import {
  SUPPORT_BUCKET,
  SUPPORT_EXTENSION_BY_MIME,
  type SupportBucketAllowedMime,
} from '../../constants/support-bucket';

/** Вложение, как оно приходит от клиента вместе с сообщением. */
export interface SupportAttachmentInput {
  /** Содержимое файла в base64. */
  content_base64: string;
  /** Заявленный клиентом размер — сервер сверяет его с фактическим. */
  size_bytes: number;
  /** Заявленный клиентом тип — сервер сверяет его с определённым по содержимому. */
  mime_type: string;
  /** Заявленная клиентом контрольная сумма — сервер пересчитывает и сверяет. */
  checksum_sha256: string;
  /** Исходное имя файла, только для отображения. */
  original_filename?: string | null;
}

/**
 * Сигнатуры разрешённых форматов.
 *
 * Тип вложения определяется по содержимому, а не берётся из объявления
 * клиента — это требование самой доменной сущности вложения. Расходы так не
 * делают (там `mime_type` уходит в хранилище как пришёл), и это осознанное
 * расхождение с образцом: у стола поддержки файл приходит от пайщика, а не от
 * члена совета, и объявленный тип — такое же непроверенное утверждение
 * клиента, как размер и контрольная сумма.
 *
 * Внешней библиотеки для этого не заводим: форматов пять, сигнатуры у них
 * фиксированы стандартом и не меняются.
 */
const MIME_SIGNATURES: ReadonlyArray<{
  mime: SupportBucketAllowedMime;
  matches: (bytes: Buffer) => boolean;
}> = [
  { mime: 'image/jpeg', matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    matches: (b) =>
      b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/gif',
    matches: (b) =>
      b.length >= 6 && (b.subarray(0, 6).toString('ascii') === 'GIF87a' || b.subarray(0, 6).toString('ascii') === 'GIF89a'),
  },
  {
    // RIFF-контейнер: сигнатура разорвана — 'RIFF', затем размер, затем 'WEBP'.
    mime: 'image/webp',
    matches: (b) =>
      b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { mime: 'application/pdf', matches: (b) => b.length >= 5 && b.subarray(0, 5).toString('ascii') === '%PDF-' },
];

/** Определяет тип по содержимому. `null` — формат не входит в разрешённые. */
export function detectSupportAttachmentMime(body: Buffer): SupportBucketAllowedMime | null {
  return MIME_SIGNATURES.find((s) => s.matches(body))?.mime ?? null;
}

/**
 * Приём вложений переписки обращения.
 *
 * Отдельной команды загрузки файла у стола нет: вложение не существует в
 * отрыве от сообщения и приходит внутри создания обращения или ответа
 * (спецификация, раздел 3). Этот сервис отвечает за всё, что происходит с
 * файлом ДО транзакции базы, и возвращает готовые метаданные, которые вызвавшая
 * команда запишет одной транзакцией вместе с самой записью ленты.
 *
 * Предел размера (10 МБ) и белый список типов проверяет сам адаптер хранилища
 * по объявлению бакета — здесь этих проверок нет намеренно, иначе правило
 * оказалось бы записано дважды и разошлось бы.
 */
@UseBucket(SUPPORT_BUCKET)
@Injectable()
export class SupportAttachmentsService {
  constructor(
    @InjectBucket() private readonly bucket: InnerFileStorageBucket,
    @Inject(SUPPORT_TICKET_ATTACHMENT_REPOSITORY)
    private readonly attachments: SupportTicketAttachmentRepository
  ) {}

  /**
   * Сверяет объявленное с фактическим, кладёт тела в хранилище и возвращает
   * метаданные для записи в базу.
   *
   * Порядок намеренно такой: разбор и сверка → загрузка тел → (снаружи)
   * транзакция базы. Если транзакция потом откатится, объекты останутся в
   * бакете сиротами — это допущено сознательно: уборка сирот в текущую фазу
   * не входит, а обратный порядок означал бы держать транзакцию открытой на
   * время загрузки файлов.
   *
   * @param ticketId обращение, к которому крепятся файлы; `null` при создании,
   *   когда обращения ещё нет и конфликтовать не с чем.
   */
  async prepare(
    ticketId: string | null,
    inputs: SupportAttachmentInput[],
    uploadedByUsername: string
  ): Promise<SupportAttachmentDraft[]> {
    const drafts: SupportAttachmentDraft[] = [];
    const seenInBatch = new Set<string>();

    for (const input of inputs) {
      const { body, checksum, mime } = this.verifyDeclared(input);

      // Уникальность — в пределах обращения, а не кооператива: один и тот же
      // снимок экрана разные пайщики прикладывают к разным обращениям, и это
      // законно. Внутри одного обращения повтор — это двойная отправка формы.
      if (seenInBatch.has(checksum)) {
        throw new BadRequestException('Один и тот же файл приложен к сообщению дважды.');
      }
      seenInBatch.add(checksum);

      if (ticketId && (await this.attachments.findByTicketAndChecksum(ticketId, checksum))) {
        throw new BadRequestException('Этот файл уже приложен к обращению.');
      }

      const storageKey = this.buildKey(checksum, mime);
      await this.bucket.put(storageKey, new Uint8Array(body), { contentType: mime });

      drafts.push({
        storageKey,
        originalFilename: input.original_filename ?? null,
        mimeType: mime,
        sizeBytes: body.byteLength,
        checksumSha256: checksum,
        uploadedByUsername,
      });
    }

    return drafts;
  }

  /**
   * Короткоживущая ссылка на скачивание вложения.
   *
   * Живёт здесь, а не в слое чтений, потому что бакет принадлежит этому
   * сервису: второе внедрение того же бакета означало бы второе объявление и
   * второй набор пределов.
   *
   * Срок жизни ссылки не задаётся здесь: его берёт объявление бакета
   * (`defaultUrlTtlSeconds`, десять минут). Поэтому ссылка и выдаётся отдельным
   * запросом, а не вместе со списком файлов — к моменту, когда пользователь
   * долистает список, она была бы мертва.
   *
   * **Права проверяет вызывающий, до вызова.** Порт хранилища доступа не
   * разграничивает: получив ссылку, скачать по ней сможет любой, у кого она
   * есть, — поэтому решение «этому ли пайщику можно» принимается раньше, на
   * доступе к обращению, которому принадлежит файл.
   */
  async getReadUrl(storageKey: string): Promise<string> {
    return this.bucket.getReadUrl(storageKey);
  }

  /**
   * Сверяет то, что клиент заявил, с тем, что пришло на самом деле.
   *
   * Заявленному не верим ни в одном из трёх пунктов: размер и контрольная
   * сумма пересчитываются по содержимому, тип определяется по сигнатуре файла.
   * Совпадение обязательно — расхождение означает либо испорченную передачу,
   * либо намеренную подмену, и в обоих случаях файл принимать нельзя.
   */
  private verifyDeclared(input: SupportAttachmentInput): {
    body: Buffer;
    checksum: string;
    mime: SupportBucketAllowedMime;
  } {
    const body = Buffer.from(input.content_base64, 'base64');
    if (body.byteLength === 0) {
      throw new BadRequestException('Пустое вложение приложить нельзя.');
    }
    if (body.byteLength !== input.size_bytes) {
      throw new BadRequestException(
        `Заявленный размер вложения (${input.size_bytes} байт) не совпадает с фактическим (${body.byteLength} байт).`
      );
    }

    const checksum = createHash('sha256').update(body).digest('hex');
    if (checksum !== input.checksum_sha256.toLowerCase()) {
      throw new BadRequestException('Заявленная контрольная сумма вложения не совпадает с фактической.');
    }

    const mime = detectSupportAttachmentMime(body);
    if (!mime) {
      throw new BadRequestException(
        'Тип вложения не определён по содержимому. Приложить можно изображение (JPEG, PNG, WebP, GIF) или PDF.'
      );
    }
    if (mime !== input.mime_type) {
      throw new BadRequestException(
        `Заявленный тип вложения (${input.mime_type}) не совпадает с определённым по содержимому (${mime}).`
      );
    }

    return { body, checksum, mime };
  }

  /**
   * Ключ адресуется содержимым и обращение в себя не включает: файлы грузятся
   * до того, как обращение получит идентификатор (при создании его ещё нет).
   * Тот же приём и по той же причине — в изображениях предложений Стола
   * заказов. Побочный эффект: одинаковый файл в двух обращениях — это два ряда
   * метаданных на один объект; при появлении удаления вложений это придётся
   * учесть (объект нельзя удалять, пока на него ссылается другое обращение).
   */
  private buildKey(checksum: string, mime: SupportBucketAllowedMime): string {
    return `${platformSettings().coopname}/support/${checksum}.${SUPPORT_EXTENSION_BY_MIME[mime]}`;
  }
}
