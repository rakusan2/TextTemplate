import { PathObj } from './tools'
export type TemplateParts = string | TemplateType

export type TempReturn = ((vars?: TempVars) => string) & { vars?: IKeyVal<boolean> }


export interface TemplateType {
    pre?: TemplateType
    args: TempArgument[]
    inner?: TemplateParts[]
    else?: TemplateType[]
    condition?: string
    name?: PathObj
    position: TemplatePosition
}

export interface TemplatePosition {
    lineNum: number
    charNum: number
    file?: {
        name: string
    }
}

export type TempArgument = { val: number | string | boolean | null } | (Iterable<number> & { length: number, str: string }) | PathObj | TemplateType

export type IKeyVal<T> = { [key: string]: T }


export interface TempVars {
    [key: string]: number |
    string |
    boolean |
    (string | number | boolean)[] |
    object |
    ((this: TempVars, ...vars: any[]) => any)
}