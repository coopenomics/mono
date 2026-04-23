import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  InterFileStorageBackendUnavailableError,
  InterFileStorageObjectNotFoundError,
} from '@coopenomics/inter';
import {
  FILE_STORAGE_OPTIONS,
  type FileStorageInfrastructureOptions,
} from './file-storage.config';
import { MinioFileStorageAdapter } from './minio-file-storage.adapter';
import { verifyReadUrl } from './signing';

/**
 * Служебная ручка отдачи объектов по HMAC-signed URL.
 *
 * Формат URL формирует `MinioFileStorageAdapter.getReadUrl`:
 *   `<publicBaseUrl>/api/storage/:bucket/:key?exp=<unix-ts>&sig=<hmac-hex>`
 *
 * - `:bucket` — публичная форма имени бакета (`<extension>-<purpose>`).
 * - `:key` — caller-defined ключ; может содержать `/`, кодируется посегментно.
 * - `exp` — unix-timestamp истечения; `now < exp` обязательно.
 * - `sig` — `HMAC-SHA256(secret, "<bucket>\n<key>\n<exp>")`, hex; constant-time сверка.
 *
 * ACL принимается ДО получения URL — на стороне доменного резолвера. Любой держатель URL до
 * истечения TTL может скачать. Утечка → утечка контента до `exp`.
 */
@Controller('api/storage')
export class FileStorageHttpController {
  private readonly logger = new Logger(FileStorageHttpController.name);

  constructor(
    @Inject(FILE_STORAGE_OPTIONS)
    private readonly opts: FileStorageInfrastructureOptions,
    private readonly adapter: MinioFileStorageAdapter,
  ) {}

  @Get(':bucket/*')
  async serve(
    @Param('bucket') bucketRaw: string,
    @Query('exp') expRaw: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const bucket = safeDecodeURIComponent(bucketRaw);
    const restRaw = (req.params as Record<string, string>)['0'] ?? '';
    const key = decodeKeyFromPath(restRaw);
    const exp = Number(expRaw);

    if (!Number.isFinite(exp) || !sig || !bucket || !key) {
      res.status(HttpStatus.FORBIDDEN).end();
      return;
    }
    const nowUnix = Math.floor(Date.now() / 1000);
    if (nowUnix >= exp) {
      res.status(HttpStatus.FORBIDDEN).end();
      return;
    }
    const ok = verifyReadUrl({
      bucket,
      key,
      expUnix: exp,
      sig,
      secret: this.opts.signingSecret,
    });
    if (!ok) {
      res.status(HttpStatus.FORBIDDEN).end();
      return;
    }

    const physicalKey = `${bucket}/${key}`;

    let obj;
    try {
      obj = await this.adapter.fetchObjectForReadProxy(physicalKey);
    } catch (e) {
      if (e instanceof InterFileStorageObjectNotFoundError) {
        res.status(HttpStatus.NOT_FOUND).end();
        return;
      }
      if (e instanceof InterFileStorageBackendUnavailableError) {
        this.logger.warn(`backend недоступен на ${physicalKey}: ${(e as Error).message}`);
        res.status(HttpStatus.BAD_GATEWAY).end();
        return;
      }
      throw e;
    }

    const remaining = Math.max(0, exp - nowUnix);
    res.setHeader('Content-Type', obj.contentType);
    if (obj.size > 0) {
      res.setHeader('Content-Length', String(obj.size));
    }
    res.setHeader('Cache-Control', `private, max-age=${remaining}`);
    res.status(HttpStatus.OK);

    obj.stream.on('error', (err) => {
      this.logger.warn(`stream error на ${physicalKey}: ${err.message}`);
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_GATEWAY).end();
      } else {
        res.end();
      }
    });
    obj.stream.pipe(res);
  }
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return '';
  }
}

function decodeKeyFromPath(rest: string): string {
  if (!rest) return '';
  return rest.split('/').map(safeDecodeURIComponent).join('/');
}
