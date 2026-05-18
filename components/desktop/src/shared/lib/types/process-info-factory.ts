import type { Component } from 'vue'

export interface IProcessInfoProps {
  processHash: string
  processType: string
  coopname: string
}

export type ProcessInfoComponent = Component<IProcessInfoProps>

export interface IProcessInfoHandler {
  infoComponent: ProcessInfoComponent
}

export type ProcessInfoHandlersRegistry = Record<string, IProcessInfoHandler>
