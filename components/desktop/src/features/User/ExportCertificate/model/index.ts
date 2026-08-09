import QRCode from 'qrcode';
import { exportFullQR } from '@coopenomics/auth';

export interface CertificateCardData {
  /** Само удостоверение — оно и уходит в код для предъявления. */
  jws: string;
  fullName: string;
  role: string;
  coopName: string;
  account: string;
  serial: string;
  validUntil: string;
}

/**
 * Карточка удостоверения размером с банковскую: 86×54 мм при 300 точках на дюйм.
 * Так распечатанное совпадает по размеру с привычным документом и помещается в
 * бумажник, а на экране телефона читается целиком без прокрутки.
 */
const CARD_W = 1016;
const CARD_H = 638;
const PAD = 56;

const INK = '#0f172a';
const INK_2 = '#475569';
const INK_3 = '#94a3b8';
const ACCENT = '#0f766e';
const LINE = '#e2e8f0';

/**
 * Выгрузка удостоверения пайщика картинкой: слева — кто это, справа — код для
 * проверки. Раньше кнопка показывала всплывающее «станет доступно в составе Vision»
 * и не делала ничего.
 *
 * Почему картинка, а не только код: голый квадрат невозможно ни предъявить человеку,
 * ни подшить — на предъявляемом документе должно быть написано, кто и в каком
 * кооперативе, а код нужен тому, кто будет проверять подпись.
 */
export function useExportCertificate() {
  /**
   * Рисует карточку и отдаёт её файлом. Согласие на выгрузку спрашивает вызывающий
   * (`confirm`) — в удостоверении персональные данные, и уходит оно из приложения
   * наружу, где хождение файла мы уже не контролируем.
   */
  async function download(data: CertificateCardData, confirm: () => Promise<boolean>): Promise<void> {
    // Проверка «кошелёк разблокирован + согласие получено» живёт в SDK, чтобы
    // выгрузка персональных данных нигде не могла случиться в обход неё.
    const payload = await exportFullQR(data.jws, { confirm });

    const qr = await renderQr(new TextDecoder().decode(payload));
    const canvas = drawCard(data, qr);
    await saveCanvas(canvas, `Удостоверение — ${data.fullName || data.account}.png`);
  }

  return { download };
}

/**
 * Код с наименьшей избыточностью: удостоверение — длинная строка, а с ростом
 * избыточности падает вместимость. Проверяющий сканирует с экрана или свежей
 * распечатки, где терять нечего.
 */
async function renderQr(text: string): Promise<HTMLImageElement> {
  let url: string;
  try {
    url = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'L',
      margin: 0,
      scale: 8,
      color: { dark: INK, light: '#ffffff' },
    });
  } catch {
    // Вместимость кода конечна (около 2900 знаков), а удостоверение растёт вместе с
    // объёмом персональных данных. Сообщаем по делу, а не «amount of data is too big».
    throw new Error(
      `Удостоверение (${text.length} знаков) не помещается в код целиком. Сообщите об этом — потребуется сокращённая форма для предъявления.`,
    );
  }
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Не удалось построить код удостоверения'));
    img.src = url;
  });
  return img;
}

function drawCard(data: CertificateCardData, qr: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал холст для отрисовки удостоверения');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Полоса цвета кооператива по левому краю — узнаётся раньше, чем прочитан текст.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, 12, CARD_H);

  const qrSize = 300;
  const qrX = CARD_W - PAD - qrSize;
  const qrY = PAD + 92;
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  const textRight = qrX - 40;
  let y = PAD + 34;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ACCENT;
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillText(data.coopName.toUpperCase(), PAD, y);

  y += 44;
  ctx.fillStyle = INK_3;
  ctx.font = '400 26px Inter, system-ui, sans-serif';
  ctx.fillText('Удостоверение пайщика', PAD, y);

  y += 78;
  ctx.fillStyle = INK;
  y = drawWrapped(ctx, data.fullName, PAD, y, textRight - PAD, 56, '700 52px Inter, system-ui, sans-serif');

  if (data.role) {
    y += 44;
    ctx.fillStyle = INK_2;
    ctx.font = '400 30px Inter, system-ui, sans-serif';
    ctx.fillText(data.role, PAD, y);
  }

  y = CARD_H - PAD - 118;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(textRight, y);
  ctx.stroke();

  y += 40;
  drawField(ctx, 'Учётная запись', data.account, PAD, y);
  drawField(ctx, 'Действует до', data.validUntil, PAD + 320, y);

  y += 66;
  drawField(ctx, 'Серийный номер', data.serial, PAD, y);

  ctx.fillStyle = INK_3;
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Подлинность проверяется сканированием кода', qrX + qrSize / 2, qrY + qrSize + 38);
  ctx.textAlign = 'left';

  return canvas;
}

/** Подпись и значение одной строкой в две строки — как в бумажном документе. */
function drawField(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number): void {
  ctx.fillStyle = INK_3;
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = INK;
  ctx.font = '500 26px Inter, system-ui, sans-serif';
  ctx.fillText(value, x, y + 32);
}

/**
 * Переносит длинное имя по словам: ФИО с отчеством в одну строку не всегда влезает,
 * а обрезать имя человека на документе недопустимо. Возвращает нижнюю границу текста.
 */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
): number {
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let cursor = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
  return cursor;
}

async function saveCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Не удалось сохранить удостоверение');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
