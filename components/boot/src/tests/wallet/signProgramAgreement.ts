// Реэкспорт из init/, чтобы существующие импорты в тестах продолжали работать.
// Сама реализация переехала в src/init/sign-program-agreement.ts — иначе
// production-цепочка `boot → init/cooperative → tests/wallet/signProgramAgreement`
// затягивала vitest при загрузке модуля и валила esno-запуск boot'а.
export { signProgramAgreement } from '../../init/sign-program-agreement'
