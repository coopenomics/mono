// Контракт «синхронизатор умеет откатываться» живёт в каркасе расширений: его
// реализуют и наследники в расширениях, и синхронизаторы ядра. Реестр —
// здесь: он сканирует граф приложения через DiscoveryService.
export { isForkAware, FORK_AWARE_MARKER, type IForkAwareSyncer } from '@coopenomics/extension-kit/sync';
export * from './fork-registry.service';
export * from './fork-registry.module';
