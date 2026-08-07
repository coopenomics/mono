import { registerEnumType } from '@nestjs/graphql';
import { WaveLabel, WavePhase } from '../../domain/utils/wave-markup';

registerEnumType(WaveLabel, {
  name: 'WaveLabel',
  description: 'Метка волны 5/3: импульс 1–5, коррекция A–C',
});

registerEnumType(WavePhase, {
  name: 'WavePhase',
  description: 'Фаза волны: импульс или коррекция',
});

export { WaveLabel, WavePhase };
