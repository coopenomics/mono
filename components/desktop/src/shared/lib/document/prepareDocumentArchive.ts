import type { IDocumentAggregate, IDocumentPackageAggregate } from 'src/entities/Document/model/types';
import { getShortNameFromCertificate } from '../utils/getNameFromCertificate';

type ZipEntry = {
  name: string;
  data: Uint8Array;
  date?: Date;
};

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
};

const toDosDateTime = (value: Date) => {
  const date = new Date(value);
  const year = date.getFullYear() - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = (year << 9) | (month << 5) | day;

  return { dosTime, dosDate };
};

const buildZipArchive = (files: ZipEntry[]): Uint8Array => {
  let offset = 0;
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const { dosDate, dosTime } = toDosDateTime(file.date ?? new Date());

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // local header signature
    localView.setUint16(4, 20, true); // version needed to extract
    localView.setUint16(6, 0, true); // general purpose bit flag
    localView.setUint16(8, 0, true); // compression method (store)
    localView.setUint16(10, dosTime, true); // last mod file time
    localView.setUint16(12, dosDate, true); // last mod file date
    localView.setUint32(14, crc, true); // crc-32
    localView.setUint32(18, file.data.length, true); // compressed size
    localView.setUint32(22, file.data.length, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true); // file name length
    localView.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); // central file header signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed to extract
    centralView.setUint16(8, 0, true); // general purpose bit flag
    centralView.setUint16(10, 0, true); // compression method
    centralView.setUint16(12, dosTime, true); // last mod file time
    centralView.setUint16(14, dosDate, true); // last mod file date
    centralView.setUint32(16, crc, true); // crc-32
    centralView.setUint32(20, file.data.length, true); // compressed size
    centralView.setUint32(24, file.data.length, true); // uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // file name length
    centralView.setUint16(30, 0, true); // extra field length
    centralView.setUint16(32, 0, true); // file comment length
    centralView.setUint16(34, 0, true); // disk number start
    centralView.setUint16(36, 0, true); // internal file attributes
    centralView.setUint32(38, 0, true); // external file attributes
    centralView.setUint32(42, offset, true); // relative offset of local header
    central.set(nameBytes, 46);

    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  });

  const centralDirectorySize = centrals.reduce((sum, entry) => sum + entry.length, 0);
  const centralDirectoryOffset = offset;

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central dir signature
  endView.setUint16(4, 0, true); // number of this disk
  endView.setUint16(6, 0, true); // number of the disk with the start
  endView.setUint16(8, files.length, true); // total number of entries on this disk
  endView.setUint16(10, files.length, true); // total number of entries
  endView.setUint32(12, centralDirectorySize, true); // size of central directory
  endView.setUint32(16, centralDirectoryOffset, true); // offset of start
  endView.setUint16(20, 0, true); // zip file comment length

  const totalSize = offset + centralDirectorySize + end.length;
  const archive = new Uint8Array(totalSize);

  let cursor = 0;
  locals.forEach((chunk) => {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  });

  centrals.forEach((chunk) => {
    archive.set(chunk, cursor);
    cursor += chunk.length;
  });

  archive.set(end, cursor);

  return archive;
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch (error) {
      console.warn('Не удалось распарсить JSON мета-данных документа', error);
      return null;
    }
  }
  return null;
};

const bufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer as ArrayBuffer;

const sha256 = async (data: Uint8Array) =>
  bufferToHex(await crypto.subtle.digest('SHA-256', toArrayBuffer(data)));

const sanitizeName = (value: string) =>
  value
    // Оставляем буквы/цифры всех алфавитов, пробелы, точки и дефисы
    .replace(/[^\p{L}\p{N}\s.\-]+/gu, '_')
    // Пробелы в подчёркивания
    .replace(/\s+/g, '_')
    // Схлопываем повторные подчёркивания
    .replace(/_+/g, '_')
    // Убираем подчёркивания по краям
    .replace(/^_+|_+$/g, '');

/**
 * Извлекает уникальный список подписантов из пакета документов
 */
export function getSignersFromDocumentPackage(packageAggregate: IDocumentPackageAggregate): string {
  const signersSet = new Set<string>();

  // Функция для обработки подписей из документа
  const processDocumentSignatures = (documentAggregate?: IDocumentAggregate | null) => {
    if (!documentAggregate?.document?.signatures) return;

    documentAggregate.document.signatures.forEach(signature => {
      if (signature.signer_certificate) {
        const displayName = getShortNameFromCertificate(signature.signer_certificate);
        if (displayName) {
          signersSet.add(displayName);
        }
      }
    });
  };

  // Обрабатываем все документы в пакете
  if (packageAggregate.statement?.documentAggregate) {
    processDocumentSignatures(packageAggregate.statement.documentAggregate);
  }

  if (packageAggregate.decision?.documentAggregate) {
    processDocumentSignatures(packageAggregate.decision.documentAggregate);
  }

  if (packageAggregate.acts?.length) {
    packageAggregate.acts.forEach(act => {
      if (act.documentAggregate) {
        processDocumentSignatures(act.documentAggregate);
      }
    });
  }

  if (packageAggregate.links?.length) {
    packageAggregate.links.forEach(link => {
      processDocumentSignatures(link);
    });
  }


  // Возвращаем уникальный список подписантов через запятую
  return Array.from(signersSet).join(', ');
}

/**
 * Уникальный список подписантов пакета документов как массив отображаемых
 * имён («Фамилия И.О.») — для рендера отдельными бейджами в таблице.
 */
export function getSignersListFromDocumentPackage(
  packageAggregate: IDocumentPackageAggregate,
): string[] {
  const signersSet = new Set<string>();

  const processDocumentSignatures = (
    documentAggregate?: IDocumentAggregate | null,
  ) => {
    if (!documentAggregate?.document?.signatures) return;
    documentAggregate.document.signatures.forEach((signature) => {
      if (signature.signer_certificate) {
        const displayName = getShortNameFromCertificate(
          signature.signer_certificate,
        );
        if (displayName) signersSet.add(displayName);
      }
    });
  };

  if (packageAggregate.statement?.documentAggregate) {
    processDocumentSignatures(packageAggregate.statement.documentAggregate);
  }
  if (packageAggregate.decision?.documentAggregate) {
    processDocumentSignatures(packageAggregate.decision.documentAggregate);
  }
  if (packageAggregate.acts?.length) {
    packageAggregate.acts.forEach((act) => {
      if (act.documentAggregate) processDocumentSignatures(act.documentAggregate);
    });
  }
  if (packageAggregate.links?.length) {
    packageAggregate.links.forEach((link) => processDocumentSignatures(link));
  }

  return Array.from(signersSet);
}

/**
 * Извлекает уникальный список фамилий подписантов из пакета документов
 */
export function getSignerSurnamesFromDocumentPackage(packageAggregate: IDocumentPackageAggregate): string {
  const surnamesSet = new Set<string>();

  // Функция для обработки подписей из документа
  const processDocumentSignatures = (documentAggregate?: IDocumentAggregate | null) => {
    if (!documentAggregate?.document?.signatures) return;

    documentAggregate.document.signatures.forEach(signature => {
      if (signature.signer_certificate) {
        const displayName = getShortNameFromCertificate(signature.signer_certificate);
        if (displayName) {
          // Извлекаем фамилию - первое слово до пробела или точки
          const surname = displayName.split(/[ \.]/)[0];
          if (surname) {
            surnamesSet.add(surname);
          }
        }
      }
    });
  };

  // Обрабатываем все документы в пакете
  if (packageAggregate.statement?.documentAggregate) {
    processDocumentSignatures(packageAggregate.statement.documentAggregate);
  }

  if (packageAggregate.decision?.documentAggregate) {
    processDocumentSignatures(packageAggregate.decision.documentAggregate);
  }

  if (packageAggregate.acts?.length) {
    packageAggregate.acts.forEach(act => {
      if (act.documentAggregate) {
        processDocumentSignatures(act.documentAggregate);
      }
    });
  }

  if (packageAggregate.links?.length) {
    packageAggregate.links.forEach(link => {
      processDocumentSignatures(link);
    });
  }

  // Возвращаем уникальный список фамилий через дефис
  return Array.from(surnamesSet).join('-');
}

/**
 * Извлекает уникальный список фамилий подписантов из документа
 */
export function getSignerSurnamesFromDocument(documentAggregate: IDocumentAggregate): string {
  const surnamesSet = new Set<string>();

  if (!documentAggregate?.document?.signatures) return '';

  documentAggregate.document.signatures.forEach(signature => {
    if (signature.signer_certificate) {
      const displayName = getShortNameFromCertificate(signature.signer_certificate);
      if (displayName) {
        // Извлекаем фамилию - первое слово до пробела или точки
        const surname = displayName.split(/[ \.]/)[0];
        if (surname) {
          surnamesSet.add(surname);
        }
      }
    }
  });

  // Возвращаем уникальный список фамилий через дефис
  return Array.from(surnamesSet).join('-');
}

const buildArchiveName = (
  rawTitle?: string | null,
  metaTitle?: unknown,
  hashPart?: string | null,
  signerSurnames?: string | null,
) => {
  const baseRaw =
    rawTitle ||
    (typeof metaTitle === 'string' ? metaTitle : null) ||
    'document';

  const base = baseRaw.endsWith('.pdf') ? baseRaw.slice(0, -4) : baseRaw;
  const hashSuffix = hashPart ? `-${hashPart}` : '';
  const signerSuffix = signerSurnames ? `-${signerSurnames}` : '';
  return sanitizeName(`${base}${hashSuffix}${signerSuffix}`);
};

export const prepareDocumentArchive = async (
  aggregate: IDocumentAggregate,
): Promise<{ blob: Blob; archiveName: string; pdfName: string }> => {
  if (!aggregate?.rawDocument?.binary) {
    throw new Error('Бинарные данные документа не найдены');
  }

  const pdfBytes = decodeBase64(aggregate.rawDocument.binary);
  const meta = parseJsonObject(aggregate.rawDocument.meta);
  const signedMeta = parseJsonObject(aggregate.document?.meta);
  const signatures = aggregate.document?.signatures ?? [];
  const certificates = signatures
    .map((signature) => signature.signer_certificate)
    .filter(Boolean);

  const uniquenessHash =
    aggregate.document?.hash ||
    aggregate.hash ||
    aggregate.rawDocument?.hash ||
    (await sha256(pdfBytes));
  const hashPart = uniquenessHash ? uniquenessHash.slice(0, 10) : null;

  // Извлекаем фамилии подписантов
  const signerSurnames = getSignerSurnamesFromDocument(aggregate);

  const pdfHash = await sha256(pdfBytes);
  const pdfNameCandidate =
    aggregate.rawDocument.full_title ||
    (meta?.title as string | undefined) ||
    'document.pdf';
  const pdfBase = pdfNameCandidate.endsWith('.pdf')
    ? pdfNameCandidate.slice(0, -4)
    : pdfNameCandidate;
  const pdfName = sanitizeName(
    `${pdfBase}${hashPart ? `-${hashPart}` : ''}${signerSurnames ? `-${signerSurnames}` : ''}.pdf`,
  );
  const archiveName = buildArchiveName(
    aggregate.rawDocument.full_title,
    meta?.title,
    hashPart,
    signerSurnames,
  );

  const signaturePayload = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    document: {
      title: meta?.title ?? null,
      full_title: aggregate.rawDocument.full_title ?? null,
      binary_hash: aggregate.rawDocument.hash ?? null,
      meta,
    },
    signed_document: aggregate.document
      ? {
          hash: aggregate.document.hash,
          doc_hash: aggregate.document.doc_hash,
          meta_hash: aggregate.document.meta_hash,
          version: aggregate.document.version,
          meta: signedMeta ?? aggregate.document.meta ?? null,
        }
      : null,
    blockchain: {
      aggregate_hash: aggregate.hash ?? null,
    },
    signatures,
    certificates,
    pdf: {
      filename: pdfName,
      mime: 'application/pdf',
      size: pdfBytes.byteLength,
      sha256: pdfHash,
    },
  };

  const manifest = encoder.encode(JSON.stringify(signaturePayload, null, 2));

  const archiveBytes = buildZipArchive([
    { name: pdfName, data: pdfBytes },
    { name: 'signature.txt', data: manifest },
  ]);

  return {
    blob: new Blob([toArrayBuffer(archiveBytes)], { type: 'application/zip' }),
    archiveName,
    pdfName,
  };
};

export const prepareDocumentPackageArchive = async (
  packageAggregate: IDocumentPackageAggregate,
): Promise<{ blob: Blob; archiveName: string }> => {
  const files: ZipEntry[] = [];
  const processedHashes = new Set<string>();

  // Определяем имя папки на основе заявления
  const statementDoc = packageAggregate.statement?.documentAggregate;
  const statementMeta = statementDoc ? parseJsonObject(statementDoc.rawDocument?.meta) : null;
  const statementTitle = statementDoc?.rawDocument?.full_title ||
                        (statementMeta?.title as string | undefined) ||
                        'Заявление';

  // Извлекаем фамилии подписантов из пакета
  const signerSurnames = getSignerSurnamesFromDocumentPackage(packageAggregate);

  // Санитизируем имя папки с добавлением фамилий подписантов
  const folderName = sanitizeName(`${statementTitle}${signerSurnames ? `-${signerSurnames}` : ''}`);

  // Собираем все документы из пакета
  const documents: IDocumentAggregate[] = [];

  // Основной документ заявления
  if (packageAggregate.statement?.documentAggregate) {
    documents.push(packageAggregate.statement.documentAggregate);
  }

  // Документ решения
  if (packageAggregate.decision?.documentAggregate) {
    documents.push(packageAggregate.decision.documentAggregate);
  }

  // Связанные документы
  if (packageAggregate.links?.length) {
    documents.push(...packageAggregate.links);
  }

  // Обрабатываем каждый документ в пакете
  for (const documentAggregate of documents) {
    if (!documentAggregate?.rawDocument?.binary) {
      console.warn('Бинарные данные документа не найдены, пропускаем', documentAggregate);
      continue;
    }

    // Проверяем дубликаты по хешу
    const docHash = documentAggregate.document?.hash ||
                   documentAggregate.hash ||
                   documentAggregate.rawDocument?.hash;

    if (docHash && processedHashes.has(docHash)) {
      console.log('Документ с таким хешем уже обработан, пропускаем', docHash);
      continue;
    }

    if (docHash) {
      processedHashes.add(docHash);
    }

    try {
      const pdfBytes = decodeBase64(documentAggregate.rawDocument.binary);
      const meta = parseJsonObject(documentAggregate.rawDocument.meta);
      const signedMeta = parseJsonObject(documentAggregate.document?.meta);
      const signatures = documentAggregate.document?.signatures ?? [];
      const certificates = signatures
        .map((signature) => signature.signer_certificate)
        .filter(Boolean);

      const uniquenessHash =
        documentAggregate.document?.hash ||
        documentAggregate.hash ||
        documentAggregate.rawDocument?.hash ||
        (await sha256(pdfBytes));
      const hashPart = uniquenessHash ? uniquenessHash.slice(0, 10) : null;

      const pdfHash = await sha256(pdfBytes);
      const pdfNameCandidate =
        documentAggregate.rawDocument.full_title ||
        (meta?.title as string | undefined) ||
        'document.pdf';
      const pdfBase = pdfNameCandidate.endsWith('.pdf')
        ? pdfNameCandidate.slice(0, -4)
        : pdfNameCandidate;

      // Извлекаем фамилии подписантов для этого документа
      const docSignerSurnames = getSignerSurnamesFromDocument(documentAggregate);

      const pdfName = sanitizeName(
        `${pdfBase}${hashPart ? `-${hashPart}` : ''}${docSignerSurnames ? `-${docSignerSurnames}` : ''}.pdf`,
      );

      const uniquePdfName = `${folderName}/${pdfName}`;

      const signaturePayload = {
        version: '1.0.0',
        generated_at: new Date().toISOString(),
        document: {
          title: meta?.title ?? null,
          full_title: documentAggregate.rawDocument.full_title ?? null,
          binary_hash: documentAggregate.rawDocument.hash ?? null,
          meta,
        },
        signed_document: documentAggregate.document
          ? {
              hash: documentAggregate.document.hash,
              doc_hash: documentAggregate.document.doc_hash,
              meta_hash: documentAggregate.document.meta_hash,
              version: documentAggregate.document.version,
              meta: signedMeta ?? documentAggregate.document.meta ?? null,
            }
          : null,
        blockchain: {
          aggregate_hash: documentAggregate.hash ?? null,
        },
        signatures,
        certificates,
        pdf: {
          filename: pdfName,
          mime: 'application/pdf',
          size: pdfBytes.byteLength,
          sha256: pdfHash,
        },
      };

      const manifest = encoder.encode(JSON.stringify(signaturePayload, null, 2));
      const signatureFileName = `${folderName}/${pdfName.replace('.pdf', '')}_signature.txt`;

      // Добавляем файлы в архив
      files.push(
        { name: uniquePdfName, data: pdfBytes },
        { name: signatureFileName, data: manifest }
      );

    } catch (error) {
      console.error('Ошибка при обработке документа пакета:', error, documentAggregate);
    }
  }

  if (files.length === 0) {
    throw new Error('Не найдено ни одного документа для архивации');
  }

  // Создаем имя архива на основе имени папки
  const archiveName = folderName;

  const archiveBytes = buildZipArchive(files);

  return {
    blob: new Blob([toArrayBuffer(archiveBytes)], { type: 'application/zip' }),
    archiveName,
  };
};
