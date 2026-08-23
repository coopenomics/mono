import { Inject, Injectable, Logger } from '@nestjs/common';
import { INTEGRATION_SETTINGS_PORT, type IIntegrationSettingsPort } from '@coopenomics/innercoop';

// Утилита для создания WAV-заголовка из PCM-данных
function createWavBuffer(pcmBuffer: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;
  const header = Buffer.alloc(headerSize);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableWhisperHttpStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 520
  );
}

export type WhisperMediaTranscribeResult = {
  text: string;
  /** после ретраев или сетевого сбоя — записать заглушку в PG, чтобы не крутить то же Matrix-событие */
  markMatrixEventSttFailed: boolean;
};

/**
 * Сервис для распознавания речи через OpenAI Whisper API
 * Использует chatcoop-proxy nginx для проксирования запросов к OpenAI
 */
@Injectable()
export class WhisperSttService {
  private readonly logger = new Logger(WhisperSttService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly language: string;

  constructor(@Inject(INTEGRATION_SETTINGS_PORT) integrations: IIntegrationSettingsPort) {
    const openai = integrations.get<{
      api_key?: string;
      base_url?: string;
      whisper_model?: string;
      whisper_language?: string;
    }>('chatcoop', 'openai');
    this.apiKey = openai?.api_key || '';
    this.baseUrl = openai?.base_url || 'https://api.openai.com/v1';
    this.model = openai?.whisper_model || 'whisper-1';
    this.language = openai?.whisper_language || 'ru';
  }

  /**
   * Проверяет, настроен ли сервис для работы
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  /**
   * Транскрибирует аудио-буфер через Whisper API
   * @param pcmBuffer - PCM-данные (16-bit)
   * @param sampleRate - Частота дискретизации
   * @param language - Язык распознавания (по умолчанию из конфигурации)
   * @param channels - Количество каналов (1=моно, 2=стерео). Whisper лучше работает с mono.
   * @returns Распознанный текст
   */
  async transcribe(
    pcmBuffer: Buffer,
    sampleRate = 48000,
    language?: string,
    channels = 1
  ): Promise<string> {
    if (!this.isConfigured()) {
      this.logger.warn('WhisperSttService не настроен (отсутствует OPENAI_API_KEY или OPENAI_BASE_URL)');
      return '';
    }

    try {
      const wavBuffer = createWavBuffer(pcmBuffer, sampleRate, channels, 16);

      // Формируем multipart/form-data запрос
      const formData = new FormData();
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      formData.append('file', blob, 'audio.wav');
      formData.append('model', this.model);
      formData.append('language', language || this.language);
      formData.append('response_format', 'text');

      const audioSecondsApprox = pcmBuffer.length / 2 / channels / sampleRate;
      this.logger.log(
        `Whisper POST /audio/transcriptions: WAV ${wavBuffer.length} B, ~${audioSecondsApprox.toFixed(2)}s audio, ${sampleRate}Hz ${channels}ch, lang=${language || this.language}`
      );

      // Отправляем запрос к Whisper API через chatcoop-proxy
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Accept-Encoding': 'gzip, deflate', // Избегаем brotli для совместимости
        },
        body: formData,
      });

      this.logger.log(`Whisper API response status: ${response.status}, headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
      }

      const text = await response.text();
      this.logger.log(`Transcription result length: ${text.length}, content: ${text.substring(0, 200)}`);

      return text.trim();
    } catch (error) {
      this.logger.error(`Ошибка транскрипции Whisper: ${error}`);
      return '';
    }
  }

  /**
   * Транскрипция произвольного медиафайла (ogg, webm, m4a и т.д.) — как голосовые в Matrix.
   * Ретраи на перегруз/таймауты; «бестолковых» error-логов нет — итог на warn после исчерпания попыток.
   */
  async transcribeMediaFile(
    fileBuffer: Buffer,
    filename: string,
    language?: string,
    /** контекст в лог при ошибке (кто вызвал STT) */
    logContext?: string
  ): Promise<WhisperMediaTranscribeResult> {
    if (!this.isConfigured()) {
      this.logger.warn('WhisperSttService не настроен (отсутствует OPENAI_API_KEY или OPENAI_BASE_URL)');
      return { text: '', markMatrixEventSttFailed: false };
    }
    if (fileBuffer.length === 0) {
      return { text: '', markMatrixEventSttFailed: false };
    }

    const hint = logContext ? ` | ${logContext}` : '';
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const formData = new FormData();
        const blob = new Blob([fileBuffer]);
        formData.append('file', blob, filename);
        formData.append('model', this.model);
        formData.append('language', language || this.language);
        formData.append('response_format', 'text');

        this.logger.log(
          `Whisper POST /audio/transcriptions: attempt ${attempt}/${maxAttempts}, file=${filename}, ${fileBuffer.length} bytes${hint}`
        );

        const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Accept-Encoding': 'gzip, deflate',
          },
          body: formData,
        });

        if (response.ok) {
          const text = (await response.text()).trim();
          return { text, markMatrixEventSttFailed: false };
        }

        const status = response.status;
        const errorText = await response.text();
        const snippet = errorText.length > 400 ? `${errorText.slice(0, 400)}…` : errorText;
        const retryable = isRetryableWhisperHttpStatus(status);

        if (retryable && attempt < maxAttempts) {
          const backoff = Math.min(12_000, 400 * 2 ** attempt + Math.floor(Math.random() * 300));
          this.logger.log(
            `Whisper STT retry ${attempt}/${maxAttempts} через ${backoff}ms (${filename}) HTTP ${status}${hint}`
          );
          await delayMs(backoff);
          continue;
        }

        if (retryable) {
          this.logger.warn(
            `Whisper STT: нет текста после ${maxAttempts} попыток (${filename}) HTTP ${status}${hint}: ${snippet}`
          );
          return { text: '', markMatrixEventSttFailed: true };
        }

        // 4xx кроме retryable (408/429): не повторять инжест Matrix по тому же событию — иначе бесконечные запросы при 401/403 и т.д.
        const markMatrixDeadLetter =
          status >= 400 && status < 500 && !isRetryableWhisperHttpStatus(status);

        this.logger.warn(`Whisper STT: без ретраев (${filename}) HTTP ${status}${hint}: ${snippet}`);
        return { text: '', markMatrixEventSttFailed: markMatrixDeadLetter };
      } catch (error) {
        if (attempt < maxAttempts) {
          const backoff = Math.min(12_000, 400 * 2 ** attempt + Math.floor(Math.random() * 300));
          this.logger.log(`Whisper STT retry ${attempt}/${maxAttempts} (сеть) через ${backoff}ms (${filename})${hint}`);
          await delayMs(backoff);
          continue;
        }
        this.logger.warn(`Whisper STT: сеть после ${maxAttempts} попыток (${filename})${hint}: ${String(error)}`);
        return { text: '', markMatrixEventSttFailed: true };
      }
    }

    return { text: '', markMatrixEventSttFailed: true };
  }
}
