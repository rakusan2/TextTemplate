import { InvalidPathError } from './lib/error'
import { ArrToItr, isIterable, numBound, parseNum } from './lib/tools'
import { IKeyVal, TemplatePosition } from './lib/types'

const pathCache: IKeyVal<string | PathPart[]> = {}
export class PathObj {
    parts: PathPart[] | string
    constructor(public path: string, public position: TemplatePosition) {
        if (path == null || path.length === 0) throw new InvalidPathError(path, position)
        const tempParts = pathCache[path]
        if (tempParts != null) {
            this.parts = tempParts
            return
        }
        this.parts = []
        let str = ''
        let isIndex = false
        for (let i = 0; i < path.length; i++) {
            const char = path[i]
            if (char === '.') {
                if (i === 0) throw new InvalidPathError(path, position)
                if (isIndex) throw new InvalidPathError(path, position)
                if (str.length > 0) {
                    this.parts.push({ key: str })
                    str = ''
                }
            } else if (char === '[') {
                if (i === 0) throw new InvalidPathError(path, position)
                if (isIndex) throw new InvalidPathError(path, position)
                isIndex = true
                if (str.length > 0) {
                    this.parts.push({ key: str })
                    str = ''
                }
            } else if (char === ']') {
                if (!isIndex) throw new InvalidPathError(path, position)
                isIndex = false
                if (str.length === 0) {
                    this.parts.push({ expand: { inc: 1 } })
                } else {
                    const index = getIndex(str)
                    if (index == null) throw new InvalidPathError(path, position)
                    if (typeof index === 'number') this.parts.push({ index })
                    else this.parts.push({ expand: index })
                    str = ''
                }
            } else {
                str += char
            }
        }
        if (isIndex) throw new InvalidPathError(path, position)
        if (str.length > 0) {
            if (this.parts.length === 0) this.parts = str
            else this.parts.push({ key: str })
        } else if (this.parts.length === 0) throw new InvalidPathError(path, position)
    }
    getFrom(vars: IKeyVal<any>) {
        const parts = this.parts
        if (typeof parts === 'string') return vars[parts]
        let obj = vars as any
        let isExpand = false
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part.key != null) {
                if (isExpand && Array.isArray(obj)) {
                    for (let i = 0; i < obj.length; i++) {
                        const val = obj[i];
                        if (val != null) {
                            obj[i] = val[part.key]
                        }
                    }
                }
                else obj = obj[part.key]
            }
            else if (part.expand != null) {
                let temp: any[] = []
                if (isExpand && Array.isArray(obj)) {
                    for (let i = 0; i < obj.length; i++) {
                        const val = obj[i];
                        if (isIterable(val)) temp.push(...itrWithRange(val, part.expand))
                    }
                } else if (isIterable(obj)) {
                    temp = itrWithRange(obj, part.expand)
                }
                if (temp.length === 0) return null
                obj = temp
                isExpand = true
            } else if (part.index != null) {
                if (isExpand && Array.isArray(obj)) {
                    for (let i = 0; i < obj.length; i++) {
                        const val = obj[i];
                        if (val == null) continue
                        if (Array.isArray(val)) {
                            obj[i] = val[part.index]
                        } else if (val instanceof ArrToItr) {
                            obj[i] = val.getAt(part.index)
                        } else if (isIterable(val)) {
                            obj[i] = getAtItrIndex(val, part.index)
                        } else obj[i] = null
                    }
                }
                else if (Array.isArray(obj)) obj = obj[part.index]
                else if (isIterable(obj)) {
                    obj = getAtItrIndex(obj, part.index)
                } else obj = null
            }
            if (obj == null) break
        }
        if (isExpand && Array.isArray(obj) && obj.every(a => a == null)) return null
        return obj
    }
    setTo(vars: IKeyVal<any>, value: any) {
        const parts = this.parts
        if (typeof parts === 'string') {
            vars[parts] = value
            return
        }
        pathPartSet(vars, value, parts)
    }
    setSimplePath(path: string) {
        this.parts = this.path = path
    }
    getFirstKey() {
        if (typeof this.parts === 'string') return this.parts
        return this.parts[0].key ?? ''
    }
}

function pathPartSet(vars: any, value: any, [part, ...otherParts]: PathPart[]): void {
    const hasNext = otherParts.length > 0
    if (part.key != null) {
        if (hasNext) {
            const obj = vars[part.key]
            pathPartSet(obj == null ? (vars[part.key] = {}) : obj, value, otherParts)
        }
        else vars[part.key] = value
    } else if (part.index != null) {
        if (hasNext) {
            if (Array.isArray(vars)) {
                const obj = vars[part.index]
                pathPartSet(obj == null ? vars[part.index] = {} : obj, value, otherParts)
            } else if (isIterable(vars)) {
                const obj = getAtItrIndex(vars, part.index)
                if (obj == null) return
                pathPartSet(obj, value, otherParts)
            }
        } else if (Array.isArray(vars)) vars[part.index] = value
    } else if (part.expand != null) {
        if (hasNext) {
            if (Array.isArray(vars)) {
                const conf = rangeToConf(part.expand, vars.length)
                if (conf == null) return
                let { start, inc, end } = conf

                for (let i = start; inc >= 0 ? i <= end : i >= end; i += inc) {
                    const obj = vars[i]
                    pathPartSet(obj == null ? vars[i] = {} : obj, value, otherParts)
                }
            }
            else if (isIterable(vars)) {
                itrWithRange(vars, part.expand).forEach(a => {
                    if (a != null) pathPartSet(a, value, otherParts)
                })
            }
        } else if (Array.isArray(vars)) {
            const conf = rangeToConf(part.expand, vars.length)
            if (conf == null) return
            let { start, inc, end } = conf

            for (let i = start; inc >= 0 ? i <= end : i >= end; i += inc) {
                vars[i] = value
            }
        }
    }
}

function itrWithRange<T>(itr: Iterable<T> | T[], range: PathRange): T[] {
    const res: T[] = []
    if (Array.isArray(itr)) {
        const conf = rangeToConf(range, itr.length)
        if (conf == null) return []
        let { start, inc, end } = conf

        for (let i = start; inc >= 0 ? i <= end : i >= end; i += inc) {
            res.push(itr[i])
        }
    } else if (itr instanceof ArrToItr) {
        const conf = rangeToConf(range, itr.length)
        if (conf == null) return []
        let { start, inc, end } = conf

        for (let i = start; inc >= 0 ? i <= end : i >= end; i += inc) {
            res.push(itr.getAt(i))
        }
    } else {
        let { start, inc, end } = range
        if (start == null && inc > 0) start = 0
        if (start == null || start < 0 || (end != null && end < 0)) return itrWithRange([...itr], range)
        const isReverse = inc < 0
        let index = 0
        if (end != null && start > end) {
            const temp = start
            start = end
            end = temp
        }
        if (inc < 0) inc = -inc
        for (const val of itr) {
            if (end != null && index > end) break
            if (index < start || (index - start) % inc === 0) {
                if (isReverse) res.unshift(val)
                else res.push(val)
            }
        }
    }
    return res
}

function getAtItrIndex<T>(itr: Iterable<T>, index: number) {
    if (itr instanceof ArrToItr) return itr.getAt(index)
    let i = 0
    for (const val of itr) {
        if (i === index) return val
    }
}

function getIndex(val: string) {
    if (val.length == 0) return null
    const num = parseNum(val)
    if (num != null) return num
    const isRange = /^([-+]?\d+)?(?::([-+]?\d+))?:([-+]?\d+)?$/.exec(val)
    if (isRange == null) return null

    const start = parseNum(isRange[1])
    let inc = parseNum(isRange[2]) ?? 1
    const end = parseNum(isRange[3])
    if (inc === 0) inc = 1
    const sign = inc >= 0 ? 1 : -1
    if (end != null && start != null && (end - start) * sign < 0) inc = -inc
    return {
        start,
        inc,
        end
    }
}

interface PathPart {
    key?: string
    index?: number
    expand?: PathRange
}

interface PathRange {
    start?: number
    inc: number
    end?: number
}

function rangeToConf(range: PathRange, len: number) {
    let { start, inc, end } = range
    const lastI = len - 1
    if (start == null) start = inc < 0 ? lastI : 0
    if (start < 0) start = len + start
    if (end == null) end = inc < 0 ? 0 : lastI
    else {
        if (end < 0) end = len + end
        if (start < 0 && end < 0) return
        end = numBound(0, end, lastI)
    }
    start = numBound(0, start, lastI)
    if ((inc < 0) === (start < end)) inc = -inc
    return { start, inc, end }
}