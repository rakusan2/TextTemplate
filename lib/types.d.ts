type TemplateParts = string | TemplateType

type TempReturn = ((vars?: TempVars) => string) & { vars?: IKeyVal<boolean> }

interface TemplateType {
    pre?: TemplateType
    args: TempArgument[]
    inner?: TemplateParts[]
    else?: TemplateType[]
    condition?: string
    name?: string
    position: { lineNum: number, charNum: number }
}

type TempArgument = { val: number | string | boolean | null } | (Iterable<number> & { str: string }) | string | TemplateType

type IKeyVal<T> = { [key: string]: T }


interface TempVars {
    [key: string]: number |
    string |
    boolean |
    (string | number | boolean)[] |
    object |
    ((this: TempVars, ...vars: any[]) => any)
}