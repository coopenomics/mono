/**
 * Короткий звуковой сигнал сканера на столе ПВЗ: оператор смотрит на полку, а
 * не на экран, и по звуку понимает, то ли он отсканировал. Высокий короткий —
 * совпало, низкий двойной — не то. Без аудиофайлов: тон собирает Web Audio.
 * Браузер без Web Audio или с запретом звука молчит — сигнал необязателен.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  ctx ??= new window.AudioContext();
  return ctx;
}

function beep(audio: AudioContext, frequency: number, start: number, duration: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.15, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration);
}

export function playScanTone(kind: 'ok' | 'error'): void {
  try {
    const audio = context();
    if (!audio) return;
    void audio.resume();
    const now = audio.currentTime;
    if (kind === 'ok') {
      beep(audio, 1320, now, 0.12);
    } else {
      beep(audio, 330, now, 0.16);
      beep(audio, 330, now + 0.22, 0.16);
    }
  } catch {
    // Звук — подсказка, а не условие работы: ошибку аудио глотаем.
  }
}
