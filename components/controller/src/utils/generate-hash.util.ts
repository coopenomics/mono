/**
 * Хэши для сущностей живут в `@coopenomics/extension-kit`: ими пользуются и
 * расширения, и ядро, а копия в двух местах разошлась бы. Здесь они доступны
 * под привычными ядру именами.
 */
export { generateUniqueHash, generateRandomHash, generateHashFromString } from '@coopenomics/extension-kit';
