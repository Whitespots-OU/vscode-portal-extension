import type {ClusterProductsMeta} from '@/models/Cluster'

import {type Instruction} from '@/models/Instruction'

export enum AutovalidatorAction {
  REJECT = 0,
  CONFIRM = 1,
  DO_NOT_TRIAGE = 2,
  TEMPORARILY = 3,
  PERMANENTLY = 4,
}

export type AutovalidatorRule = {
  id: number
  is_active: boolean
  instructions: Instruction[]
  action_choices: AutovalidatorAction
  tags: string[]
  groups: string[]
  read_only: boolean
  issues_auto_create_on_verify: boolean | null
} & ClusterProductsMeta
