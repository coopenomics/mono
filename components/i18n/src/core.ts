/**
 * Общие словари пакета по языкам. Каждый потребитель сливает их со своими:
 * `mergeMessages(structuredClone(coreMessages.ru), own)`.
 *
 * common, validation, errors — общие фразы, проверки и коды отказов;
 * authClient, sdkClient — тексты клиентских библиотек @coopenomics/auth и
 * @coopenomics/sdk; kit — тексты каркаса расширений @coopenomics/extension-kit.
 * Новый файл словаря пакета — новая строка здесь.
 */
import authClient from './messages/ru/authClient.json';
import common from './messages/ru/common.json';
import errors from './messages/ru/errors.json';
import kit from './messages/ru/kit.json';
import sdkClient from './messages/ru/sdkClient.json';
import validation from './messages/ru/validation.json';
import { mergeMessages, type LocaleMessages, type MessageTree } from './messages';

const RU: Array<[string, MessageTree]> = [
  ['authClient', authClient as MessageTree],
  ['common', common as MessageTree],
  ['errors', errors as MessageTree],
  ['kit', kit as MessageTree],
  ['sdkClient', sdkClient as MessageTree],
  ['validation', validation as MessageTree],
];

export const coreMessages: LocaleMessages = {
  ru: RU.reduce<MessageTree>((acc, [name, tree]) => mergeMessages(acc, tree, name), {}),
};
