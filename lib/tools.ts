import { TemplateType } from './types'

export function parseNum(val: string) {
    if (val == null || val.length == 0) return
    if (/^[-+]?(0x[\da-f]+|\d+)$/i.test(val)) return parseInt(val)
    const isBin = /^([-+]?)0b([01])+$/i.exec(val)
    if (isBin != null) return parseInt(isBin[1] + isBin[2], 2)
    if (/^[-+]?\d+\.\d+$/.test(val)) return parseFloat(val)
}

export function getNumber(val: any) {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
        const num = parseNum(val)
        if (num != null) return num
    }
    throw new Error('Cannon parse to number')
}

export function getRange(start: number, end: number, inc?: number) {
    if (inc === 0 || inc == null) inc = 1
    if ((start > end && inc > 0) || (start < end && inc < 0)) inc = -inc
    const increment = inc
    return function* test() {
        if (start === end) {
            yield start
            return
        }
        for (let i = start; i <= end; i += increment) {
            yield i
        }
    }
}

export function checkArgMin(block: TemplateType, min: number, key: string) {
    if (block.args.length < min) throw new Error(`"${key}" requires at lest ${min - 1} Arguments (${getPosition(block)})`)
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

export function isInvisibleChar(char: string) {
    return char === '\n' || char === '\t' || char === '\b' || char === '\r'
}

export function numBound(min: number, value: number, max: number) {
    if (value < min) return min
    if (value > max) return max
    return value
}

export class ArrToItr<T> implements Iterable<T> {
    constructor(public length: number, private func: (index: number) => T) { }
    *[Symbol.iterator]() {
        for (let i = 0; i < this.length; i++) {
            yield this.func(i)
        }
    }
    getAt(index: number) {
        if (index >= this.length || index < 0) return null
        return this.func(index)
    }
}