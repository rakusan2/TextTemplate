import { parseNum, getRange, checkArgMin } from './tools'
import { TemplateParts, TemplateType } from './types'

export class StringSplitter {
    static get(str: string) {
        const ss = new StringSplitter()
        ss.add(str)
        return ss.finish()
    }
    last = {
        foundBlock: undefined as undefined | TemplateType,
        foundEscape: false,
        isQuote: '',
        arg: '',
        lineNum: 1,
        charNum: 0,
        ignoreSpace: false
    }
    res: TemplateParts[] = []
    add(str: string) {
        let start = 0
        let { foundBlock, foundEscape, isQuote, arg, lineNum, charNum, ignoreSpace } = this.last
        let i = start
        while (true) {
            if (!foundBlock) for (; i < str.length; i++) {
                const char = str[i];
                if (char === '\n') {
                    if (ignoreSpace) {
                        ignoreSpace = false
                        start = i + 1
                    }
                    charNum = 0
                    lineNum++
                } else {
                    charNum++
                }
                if (ignoreSpace && /[^\s]/.test(char)) ignoreSpace = false
                if (foundEscape) {
                    foundEscape = false
                } else if (char === '{') {
                    if (i > start) this.res.push(str.slice(start, i))
                    foundBlock = { args: [], position: { lineNum, charNum } }
                    i++
                    start = i
                    arg = ''
                    break
                } else if (char === '\\') {
                    if (i > start) this.res.push(str.slice(start, i))
                    foundEscape = true
                    start = i + 1
                }
            }
            if (i >= str.length) {
                if (i - start > 0) this.res.push(str.slice(start))
                this.last.foundBlock = foundBlock
                this.last.foundEscape = foundEscape
                this.last.arg = arg
                this.last.lineNum = lineNum
                this.last.charNum = charNum
                this.last.ignoreSpace = ignoreSpace
                return
            }
            if (foundBlock == null) throw new Error(`Invalid foundBlock`)
            ignoreSpace = onEmptyLine(this.res)
            for (; i < str.length; i++) {
                const char = str[i];

                if (char === '\n') {
                    charNum = 1
                    lineNum++
                } else {
                    charNum++
                }
                if (foundEscape) {
                    foundEscape = false
                    if (char === 't') arg += '\t'
                    else if (char === 'n') arg += '\n'
                    else if (char === 'b') arg += '\b'
                    else arg += char
                } else if (isQuote.length > 0) {
                    if (char === '\\') {
                        foundEscape = true
                    } else if (char === isQuote) {
                        foundBlock.args.push({ val: arg })
                        arg = ''
                        isQuote = ''
                    } else {
                        arg += char
                    }
                } else if (char === '"' || char === "'") {
                    if (arg.length > 0) {
                        foundBlock.args.push(convertArg(arg))
                        arg = ''
                    }
                    isQuote = char
                } else if (char === '{') {
                    if (arg.length > 0) {
                        foundBlock.args.push(convertArg(arg))
                        arg = ''
                    }
                    const temp: TemplateType = { args: [], pre: foundBlock, position: { lineNum, charNum } }
                    foundBlock.args.push(temp)
                    foundBlock = temp
                } else if (char === '}') {
                    if (arg.length > 0) {
                        foundBlock.args.push(convertArg(arg))
                        arg = ''
                    }

                    removeKeyExtra(foundBlock)
                    const temp = foundBlock
                    foundBlock = foundBlock.pre
                    if (foundBlock == null) {
                        this.res.push(temp)
                        i++
                        start = i
                        break
                    }
                } else if (char === ' ' || char === '\n' || char === '\t') {
                    if (arg.length > 0) {
                        foundBlock.args.push(convertArg(arg))
                        arg = ''
                    }
                } else {
                    arg += char
                }
            }
            if (i >= str.length) {
                if (i - start > 0) this.res.push(str.slice(start))
                this.last.foundBlock = foundBlock
                this.last.foundEscape = foundEscape
                this.last.arg = arg
                this.last.isQuote = isQuote
                this.last.lineNum = lineNum
                this.last.charNum = charNum
                this.last.ignoreSpace = ignoreSpace
                return
            }
        }
    }
    finish() {
        const { foundBlock, arg, isQuote } = this.last
        if (foundBlock == null) return toControlGroups(this.res)
        if (isQuote.length > 0) foundBlock.args.push(arg)
        else if (arg.length > 0) foundBlock.args.push(convertArg(arg))
        let last = foundBlock
        let temp = last.pre
        while (temp != null) {
            last = temp
            temp = temp.pre
        }
        removeKeyExtra(last)
        this.res.push(last)
        return toControlGroups(this.res)
    }
}

function convertArg(val: string): string | { val: string | number | boolean | null } | (Iterable<number> & { str: string }) {
    val = val.trim()
    if (val === 'false') return { val: false }
    if (val === 'true') return { val: true }
    if (val === 'null') return { val: null }
    const isNum = parseNum(val)
    if (isNum != null) return { val: isNum }
    const isRange = /^(\d+)(?::(\d+))?:(\d+)$/.exec(val)
    if (isRange != null) {
        const start = parseNum(isRange[1])
        const inc = parseNum(isRange[2])
        const end = parseNum(isRange[3])
        if (start == null || end == null) return val
        return { str: val, [Symbol.iterator]: getRange(start, end, inc) }
    }
    return val
}

function removeKeyExtra(val: TemplateType) {
    if (val.args.length === 0) return
    const key = val.args[0]
    if (typeof key !== 'string') return
    const extra = /^(if|for|else|\?)(==|<=?|>=?|~)?(?::([^\d\s][^\s]*))?$/.exec(key)
    if (extra != null) {
        const temp = extra[1]
        val.args[0] = temp
        val.condition = extra[2]
        val.name = extra[3]
        if (temp === 'if' || temp === 'for') checkArgMin(val, 2, temp)
        else if (temp === '?') checkArgMin(val, val.condition == null ? 3 : 4, temp)
    }
    else if (key === '+' || key === '-' || key === '/' || key === '*' || key === '%') checkArgMin(val, 2, key)
    else if (key === '=' || key === '=?') checkArgMin(val, 3, key)
}


function toControlGroups(arr: TemplateParts[]): TemplateParts[] {
    const res: TemplateParts[] = []
    const que: { key: string, el: TemplateType }[] = []
    let working: { key: string, el: TemplateType } | null = null
    function close(key: 'if' | 'for', onlyAbove = false) {
        if (working == null) return
        if (working.key === key) {
            if (onlyAbove) return
            working = que.pop() ?? null
            return
        }
        if (que.length === 0) return
        for (let i = que.length - 1; i >= 0; i--) {
            const elKey = que[i].key
            if (elKey === key) {
                while (working != null && working.key !== key) {
                    working = que.pop() ?? null
                }
                if (onlyAbove) return
                if (working != null) working = que.pop() ?? null
                return
            } else if (elKey === 'for') return
        }

    }
    function open(key: string, el: TemplateType) {
        if (working == null) {
            res.push(el)
            working = { key, el }
        } else {
            if (key === 'else') {
                close('if', true)
                if (working == null || working.key !== 'if') {
                    const { lineNum, charNum } = working.el.position
                    console.error(`No "if". Removing "else" (${lineNum}:${charNum})`)
                    return
                } else {
                    if (working.el.else == null) working.el.else = [el]
                    else working.el.else.push(el)
                }
            } else {
                if (working.el.inner == null) working.el.inner = [el]
                else working.el.inner.push(el)
            }
            que.push(working)
            working = { key, el }
        }
    }
    function add(el: TemplateParts) {
        if (working != null) {
            if (working.el.inner == null) working.el.inner = [el]
            else working.el.inner.push(el)
        } else {
            res.push(el)
        }
    }
    for (let i = 0; i < arr.length; i++) {
        const el = arr[i];
        if (typeof el === 'string') {
            add(el)
        } else {
            const key = el.args[0]
            if (typeof key !== 'string') {
                add(el)
            } else if (key === 'for') {
                open('for', el)
            } else if (key === 'rof') {
                close('for')
            } else if (key === 'if') {
                open('if', el)
            } else if (key === 'else') {
                open('else', el)
            } else if (key === 'fi') {
                close('if')
            } else add(el)
        }
    }
    return res
}

function onEmptyLine(arr: TemplateParts[]) {
    if (arr.length === 0) return true
    for (let i = arr.length - 1; i >= 0; i--) {
        const el = arr[i]
        if (typeof el !== 'string') continue
        for (let i = el.length - 1; i >= 0; i--) {
            const char = el[i]
            if (char === '\n' || char === '\b' || char === '\r') return true
            if (char !== ' ' && char !== '\t') return false
        }
    }
    return true
}