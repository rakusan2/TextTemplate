export type TemplateParts = string | TemplateType

export type TempReturn = ((vars?: TempVars) => string) & { vars?: IKeyVal<boolean> }

export interface TemplateType {
    pre?: TemplateType
    args: TempArgument[]
    inner?: TemplateParts[]
    else?: TemplateType[]
    condition?: string
    name?: string
    position: { lineNum: number, charNum: number }
}

export type TempArgument = { val: number | string | boolean | null } | (Iterable<number> & { str: string }) | string | TemplateType

export type IKeyVal<T> = { [key: string]: T }


export interface TempVars {
    [key: string]: number |
    string |
    boolean |
    (string | number | boolean)[] |
    object |
    ((this: TempVars, ...vars: any[]) => any)
}