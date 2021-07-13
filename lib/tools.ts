export function parseNum(val: string) {
    if (val == null || val.length == 0) return
    if (/^(0x[\da-f]+|\d+)$/i.test(val)) return parseInt(val)
    const isBin = /^0b([01])+$/i.exec(val)
    if (isBin != null) return parseInt(isBin[1])
    if (/^\d+\.\d+$/.test(val)) return parseFloat(val)
}

export function getNumber(val: any) {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
        const num = parseNum(val)
        if (num != null) return num
    }
    throw new Error('Cannon parse to number')
}

export function getRange(start: number, end: number, inc = 1) {
    return function* test() {
        for (let i = start; i <= end; i += inc) {
            yield i
        }
    }
}

export function checkArgMin(block: TemplateType, min: number, key: string) {
    if (block.args.length < min) throw new Error(`"${key}" requires at lest ${min - 1} Arguments (${getPosition(block)})`)
}

export function setValue(key: string, vars: TempVars, value: any) {
    const path = key.split(/\][\.\[]|[\.\[\]]/).filter(a => a.length > 0)
    followSetPath(path, vars, value)
}

export function getValue(key: string, vars: TempVars) {
    const path = key.split(/\][\.\[]|[\.\[\]]/).filter(a => a.length > 0)
    return followGetPath(path, vars)
}

export function followGetPath([key, ...rest]: string[], obj: any): any {
    const temp = obj[key]
    if (rest.length === 0 || temp == null) return temp
    return followGetPath(rest, temp)
}

export function followSetPath([key, ...rest]: string[], obj: any, value: any) {
    if (rest.length === 0) {
        obj[key] = value
        return
    }
    let temp = obj[key]
    if (temp == null || typeof temp !== 'object') {
        temp = {}
        obj[key] = temp
    }
    followSetPath(rest, temp, value)
}

export function isIterable(val: any): val is Iterable<any> {
    if (val == null) return false
    return typeof val[Symbol.iterator] === 'function'
}

export function getPosition({ position: { lineNum, charNum } }: TemplateType) {
    return `${lineNum}:${charNum}`
}

export function isCondition(val: any): val is 'string' | 'number' | 'boolean' | 'array' {
    if (typeof val !== 'string') return false
    return ['string', 'number', 'boolean', 'array'].includes(val)
}