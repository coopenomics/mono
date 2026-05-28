import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired';
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index';

// Селектор для сегмента транскрипции
const rawTranscriptionSegmentSelector = {
  id: true,
  speakerIdentity: true,
  speakerName: true,
  text: true,
  startOffset: true,
  endOffset: true,
  createdAt: true,
};

// Проверка валидности
const _validateSegment: MakeAllFieldsRequired<ValueTypes['TranscriptionSegment']> = rawTranscriptionSegmentSelector;

export type TranscriptionSegmentModel = ModelTypes['TranscriptionSegment'];

export const transcriptionSegmentSelector = Selector('TranscriptionSegment')(rawTranscriptionSegmentSelector);
export { rawTranscriptionSegmentSelector };

// Селектор для транскрипции звонка
const rawCallTranscriptionSelector = {
  id: true,
  roomId: true,
  roomName: true,
  startedAt: true,
  endedAt: true,
  participants: true,
  status: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
};

// Проверка валидности
const _validateTranscription: MakeAllFieldsRequired<ValueTypes['CallTranscription']> = rawCallTranscriptionSelector;

export type CallTranscriptionModel = ModelTypes['CallTranscription'];

export const callTranscriptionSelector = Selector('CallTranscription')(rawCallTranscriptionSelector);
export { rawCallTranscriptionSelector };

// Селектор для транскрипции с сегментами
const rawCallTranscriptionWithSegmentsSelector = {
  transcription: rawCallTranscriptionSelector,
  segments: rawTranscriptionSegmentSelector,
};

// Проверка валидности
const _validateWithSegments: MakeAllFieldsRequired<ValueTypes['CallTranscriptionWithSegments']> = rawCallTranscriptionWithSegmentsSelector;

export type CallTranscriptionWithSegmentsModel = ModelTypes['CallTranscriptionWithSegments'];

export const callTranscriptionWithSegmentsSelector = Selector('CallTranscriptionWithSegments')(rawCallTranscriptionWithSegmentsSelector);
export { rawCallTranscriptionWithSegmentsSelector };
