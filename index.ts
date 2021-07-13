import { createReadStream } from 'fs';
import { StringSplitter } from './lib/StringSpliter';
import { getValue, getNumber, getPosition, isCondition, isIterable, setValue } from './lib/tools';
import { IKeyVal, TempArgument, TemplateParts, TemplateType, TempReturn, TempVars } from './lib/types';
export { TempReturn } from './lib/types'
/*
\{<anything>} ignores
{<key> <...values>}
{<functionKey> <...arguments>}
{<operation> <...value>}
{= <key> <...value>} Set key
{=<operation> <key> <...value>} Set after math operation
{=? <key> <...value>} Set key if null
{=?<operation> <key> <...value>} Set key after math operation if null
{itr <...values>} Creates an iterable object
{? <key> <ifExist> <ifNot>} Ternary
{?<condition> <left> <right> <true> <false>} Ternary
{if <key>} Conditional start if key exists.
{if<condition> <left> <right>} Conditional start.
{else <?key>} Conditional else
{else<condition> <left> <right>} Conditional else
{fi} Conditional end
{for<?:name> <...value>} Enumeration
{rof} End enumeration

<value> = <key> <string> <number> <boolean> <range>(start:end | start:increment:end)
<condition> = == | < | > | <= | >= | ~
<operation> = + | - | / | * | %
 */
export function loadFile(path: string, options?: TemplateOptions) {
    return new Promise<TempReturn>((res, rej) => {
        const ss = new StringSplitter()
        createReadStream(path, 'utf8')
            .on('error', rej)
            .on('data', (data: string) => {
                ss.add(data)
            })
            .on('close', () => {
                res(createReturn(ss.finish(), options))
            })
    })

}

export function compile(val: string, options?: TemplateOptions) {
    return createReturn(StringSplitter.get(val), options)
}

export function render(file: string, vars?: TempVars, options?: TemplateOptions) {
    const comp = compile(file, options)
    return comp(vars)
}

export interface TemplateOptions {
    /** Default variable values */
    defaults?: TempVars
    defaultFunction?: (key: string, ...args: any[]) => any
    /** Array join separator (default `', '`) */
    separator?: string
    /** Max For loop iterations (default 100) */
    maxIterations?: number
    /**
     *  Allow first operant to be a block
     * 
     * Sets key if block returns string or number
     * 
     * Sets function if block return a function
     * 
     * Default: `false`
    */
    allowKeyBlocks?: boolean
    /**
     * Throws on missing variable
     * 
     * Default: `true`
     */
    throwOnMissing?: boolean
    /** Set `this` to Vars */
    setFunctionThis?: boolean
    /** Add vars property to return of compile */
    addVars?: boolean
}

function createReturn(arr: TemplateParts[], options: TemplateOptions = {}) {
    const res: TempReturn = function(val = {}) {
        const vars = options.defaults == null ? val : { ...options.defaults, ...val }
        return joinParts(arr, vars, options)
    }
    if (options.addVars === true) res.vars = getVars(arr)
    return res
}

function getVars(arr: TemplateParts[]): IKeyVal<boolean> {
    const getKeys = new Set<string>()
    const setKeys = new Set<string>()
    for (let i = 0; i < arr.length; i++) {
        const part = arr[i];
        if (typeof part === 'string') continue
        getVarKeys(part.args, setKeys, getKeys)

    }
    const res: IKeyVal<boolean> = {}
    for (const key of getKeys) {
        res[key] = true
    }
    return res
}

const predefined = /^(=\??[\+\-\/\*%]?|[\+\-\/\*%]|itr|(\?|if|else)(==|<=?|>=?|~)?|fi|rof|for)$/
function getVarKeys(args: TempArgument[], setKeys: Set<string>, getKeys: Set<string>) {
    let skip1 = false
    let set1 = false
    const keysToSet: string[] = []

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (typeof arg === 'string') {
            if (i === 0) {
                if (predefined.test(arg)) {
                    if (arg[0] === '=') {
                        set1 = true
                    }
                    if (arg !== 'itr') skip1 = true
                } else {
                    if (args.length === 1 && !setKeys.has(arg)) getKeys.add(arg)
                }
            }
            else if (i !== 1 || !skip1) {
                if (!setKeys.has(arg)) getKeys.add(arg)
            }
            if (i !== 1 || set1) {
                keysToSet.push(arg)
            }
        }
        else if ('args' in arg) {
            getVarKeys(arg.args, setKeys, getKeys)
        }
    }
    keysToSet.forEach(a => setKeys.add(a))
}

function joinParts(arr: TemplateParts[], vars: TempVars, options: TemplateOptions) {
    let str = ''
    for (let i = 0; i < arr.length; i++) {
        const el = arr[i];
        if (typeof el === 'string') {
            str += el
            continue
        }
        str += runBlockFin(el, vars, options)
    }
    return str
}

function runCondition(block: TemplateType, vars: TempVars, options: TemplateOptions) {
    const [_, left, right] = block.args
    const condition = block.condition
    if (condition == null) {
        if (left == null) throw new Error(`Invalid Condition (${getPosition(block)})`)
        const setKey = getArgumentStr(left, vars, options)
        return getValue(setKey, vars) != null
    } else {
        if (left == null || right == null) throw new Error(`Invalid Condition (${getPosition(block)})`)
        const leftVal = getArgumentVal(left, vars, options)
        const rightVal = getArgumentVal(right, vars, options)
        if (condition === '==') {
            return leftVal == rightVal
        } else if (condition === '~') {
            if (!isCondition(rightVal)) throw new Error(`Invalid type comparison (${getPosition(block)})`)
            return (rightVal === 'array' && (typeof leftVal !== 'string') && isIterable(leftVal)) || (typeof leftVal === rightVal)
        } else {
            const leftNum = getNumber(leftVal)
            const rightNum = getNumber(rightVal)
            return (condition === '>' && leftNum > rightNum) ||
                (condition === '<' && leftNum < rightNum) ||
                (condition === '>=' && leftNum >= rightNum) ||
                (condition === '<=' && leftNum <= rightNum)
        }
    }
}

function runBlock(block: TemplateType, vars: TempVars, options: TemplateOptions): any {
    if (block.args.length === 0) return null
    let [key, ...args] = block.args
    if (typeof key !== 'string') {
        if (isIterable(key)) return key
        if ('val' in key) return key.val
        if (options.allowKeyBlocks !== true) {
            console.warn(`Keys can not have Blocks. Use options.allowKeyBlocks to change this (${getPosition(key)})`)
            return null
        }
        if (key.args.length <= 0) return null
        const res = runBlock(key, vars, options)
        if (typeof res === 'string') key = res
        else if (typeof res === 'function') {
            res(...args.map(a => (typeof a === 'string') ? vars[a] : isIterable(a) ? a : 'val' in a ? a.val : runBlock(a, vars, options)))
            return
        } else {
            if (args.length > 0) {
                console.warn(`Key is a value. Ignoring Arguments (${getPosition(key)})`)
            }
            return res
        }
    }
    let reg: RegExpExecArray | null
    if (key === 'if') {
        if (runCondition(block, vars, options)) {
            if (block.inner != null) return joinParts(block.inner, vars, options)
        } else if (block.else != null) {
            for (let i = 0; i < block.else.length; i++) {
                const el = block.else[i];
                if (el.args.length === 1 || runCondition(el, vars, options)) {
                    if (el.inner != null) return joinParts(el.inner, vars, options)
                    return null
                }
            }
        }
    } else if (key === 'for') {
        if (args.length === 0) throw new Error(`for requires at least one argument (${getPosition(block)})`)
        if (block.inner == null) return null
        const itr = args.length === 1 ? getArgumentVal(args[0], vars, options) : getArgIterable(args, vars, options)
        if (isIterable(itr)) {
            let str = ''
            let i = 0
            const max = options.maxIterations ?? 100
            for (const val of itr) {
                i++
                if (max > 0 && i > max) break
                if (block.name != null) setValue(block.name, vars, val)
                str += joinParts(block.inner, vars, options)
            }
            return str
        } else {
            if (block.name != null) setValue(block.name, vars, itr)
            return joinParts(block.inner, vars, options)
        }
    } else if (key === '?') {
        if (block.condition == null) {
            if (args.length < 2) throw new Error(`? Requires at least 2 arguments (${getPosition(block)})`)
            if (runCondition(block, vars, options)) {
                return getArgumentVal(args[1], vars, options)
            } else {
                return getArgumentVal(args[2], vars, options)
            }
        } else {
            if (args.length < 3) throw new Error(`? Requires at least 3 arguments (${getPosition(block)})`)
            if (runCondition(block, vars, options)) {
                return getArgumentVal(args[2], vars, options)
            } else {
                return getArgumentVal(args[3], vars, options)
            }
        }
    } else if (key === 'itr') {
        if (args.length > 0) {
            return getArgIterable(args, vars, options)
        }
    } else if (key === '=' || key === '=?') {
        if (args.length <= 1) return null
        const arg0 = args.shift()
        if (arg0 == null) return null
        const setKey = getArgumentStr(arg0, vars, options)
        if (key.length === 2) {
            const val = getValue(setKey, vars)
            if (val != null) return null
        }
        const argVals = args.map(a => getArgumentVal(a, vars, options))
        if (argVals.length === 0) return null
        if (argVals.length === 1) setValue(setKey, vars, argVals[0])
        else setValue(setKey, vars, argVals)
        return null
    } else if ((reg = /^(?:=\??)?(\+|-|\/|\*|%)$/.exec(key)) != null) {
        if (args.length === 0) return null
        const opt = reg[1]
        let setKey: any = null
        if (key[0] === '=') {
            if (args.length <= 2) return null
            const arg0 = args.shift()
            if (arg0 == null) return null
            setKey = getArgumentStr(arg0, vars, options)
            if (key[1] === '?') {
                const val = getValue(setKey, vars)
                if (val != null) return
            }
        }
        let argVals = args.map(a => getArgumentVal(a, vars, options))
        if (argVals.length === 1) {
            const temp = argVals[0]
            if (Array.isArray(temp)) argVals = temp
            if (isIterable(temp)) argVals = [...temp]
        }
        const allNum = argVals.every(a => typeof a === 'number')
        const allNumOrStr = allNum || argVals.every(a => (typeof a === 'number') || (typeof a === 'string'))
        if (!allNumOrStr) throw new Error(`Operation block has invalid type (${getPosition(block)})`)
        let res = null
        if (opt === '-') {
            res = argVals.map(getNumber).reduce((acc, a) => acc - a)
        } else if (opt === '/') {
            res = argVals.map(getNumber).reduce((acc, a) => acc / a)
        } else if (opt === '%') {
            res = argVals.map(getNumber).reduce((acc, a) => acc % a)
        } else if (opt === '+') {
            if (allNum) res = (<number[]>argVals).reduce((acc, a) => acc + a)
            else res = (<(number | string)[]>argVals).reduce((acc, a) => '' + acc + a)
        } else if (opt === '*') {
            if (allNum) res = (<number[]>argVals).reduce((acc, a) => acc * a)
            else {
                const str: string = argVals.find(a => typeof a === 'string')
                const count = argVals.filter(a => typeof a === 'number').reduce((acc, a) => acc * a, 1)
                if (str == null) return count
                else {
                    if ((count * str.length) > 100_000) throw new Error(`Resulting string has more than 100k characters (${getPosition(block)})`)
                    res = ''
                    for (let i = 0; i < count; i++) {
                        res += str
                    }
                }
            }
        }
        if (typeof setKey === 'string') {
            setValue(setKey, vars, res)
        } else return res
        return null
    } else {
        const val = getValue(key, vars)
        if (val == null) {
            if (options.defaultFunction != null) return options.defaultFunction(key, args.map(a => getArgumentVal(a, vars, options)))
            if (args.length > 0) {
                if (args.length === 1) return getArgumentVal(args[0], vars, options)
                return args.map(a => getArgumentVal(a, vars, options))
            }
            if (options.throwOnMissing !== false) throw new MissingKeyValueError(key)
            return null
        }
        if (typeof val === 'function') {
            if (options.setFunctionThis === true) {
                return (<Function>val).apply(vars, args.map(a => getArgumentVal(a, vars, options)))
            } else {
                return val(...args.map(a => getArgumentVal(a, vars, options)))
            }
        }
        return val
    }
}

function getArgumentVal(arg: TempArgument, vars: TempVars, options: TemplateOptions) {
    if (arg == null) return null
    if (typeof arg === 'string') {
        const res = getValue(arg, vars)
        if (typeof res === 'undefined' && options.throwOnMissing) throw new MissingKeyValueError(arg)
        return res
    }
    if (isIterable(arg)) return arg
    if ('val' in arg) return arg.val
    return runBlock(arg, vars, options)
}

export class MissingKeyValueError extends Error {
    constructor(public key: string, title?: string) {
        super(title ?? `Missing Key "${key}"`)
    }
}

function runBlockFin(block: TemplateType, vars: TempVars, options: TemplateOptions): string {
    const res = runBlock(block, vars, options)
    if (res == null) return ''
    if (typeof res === 'string') return res
    if ((typeof res === 'number') || (typeof res === 'boolean') || (typeof res === 'bigint')) return res.toString()
    if (Array.isArray(res)) {
        return res.map(a => a == null ? '' : a).join(options.separator ?? ', ')
    }
    if (isIterable(res)) return [...res].filter(a => a != null).join(options.separator ?? ', ')
    if (typeof res === 'object') {
        for (const key in res) {
            if ((<object>res).hasOwnProperty(key)) {
                vars[key] = res[key]
            }
        }
    }
    return ''
}

export function getArgIterable(args: TempArgument[], vars: TempVars, options: TemplateOptions) {
    return {
        length: args.length,
        *[Symbol.iterator]() {
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                yield getArgumentVal(arg, vars, options)
            }
        }
    }
}

export function getArgumentStr(arg: TempArgument, vars: TempVars, options: TemplateOptions) {
    if (typeof arg === 'string') return arg
    if ('val' in arg) {
        if (typeof arg.val === 'string') return arg.val
        if (typeof arg.val === 'number') return arg.val.toFixed(0)
    }
    if ('args' in arg) {
        const res = runBlock(arg, vars, options)
        if (typeof res === 'string') return res
        throw new Error(`Block returned invalid key (${getPosition(arg)})`)
    }
    throw new Error(`Invalid key. Got ${('val' in arg) ? arg.val : arg.str}`)
}