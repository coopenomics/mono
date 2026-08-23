/**
 * Событие приёма пайщика живёт в контракте `@coopenomics/innercoop`: сообщает
 * о нём ядро, слушают расширения. Здесь оно доступно под привычным ядру именем.
 */
export type { InnerParticipantRegisteredEvent as ParticipantRegisteredEvent } from '@coopenomics/innercoop';
