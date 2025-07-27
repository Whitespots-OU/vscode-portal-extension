import type {Finding} from './Finding'

import {type AssetField} from './Asset'

export type InstructionFieldAsset = `Finding__${ AssetField }`

export type InstructionField = `Finding__${ keyof Pick<
    Finding,
    'name'
    | 'description' 
    | 'severity'
    | 'file_path'
    | 'line'
    | 'dependency'
    | 'vulnerable_url'
    | 'branch'
  > }`
  | 'Scanner__name'
  | 'External_system__dojo_finding_id'
  | 'Tag__name'
  | InstructionFieldAsset

export type Instruction = {
  id: number
  field: InstructionField
  value: string
  negate: boolean
  regex: boolean
}
