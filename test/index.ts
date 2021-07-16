import { render, compile, MissingKeyValueError, compileFile } from '..'
import { strictEqual, throws, doesNotReject } from 'assert'
import { readdir } from 'fs/promises'
import path from 'path'

throws(() => render('{n}'), MissingKeyValueError, 'Missing Value')
strictEqual(render('\\{}'), '{}', 'Test Escape')
strictEqual(render('{n 5}'), '5', 'Default Value')
strictEqual(render('{n.length}', { n: 'lol' }), '3', 'Path Exploration')
strictEqual(render('{n 5 9}'), '5, 9')
strictEqual(render('{= n 5}{n}'), '5')
strictEqual(render('{= n {+ 5 9}}{n}'), '14')
strictEqual(render('{+ n 5 9}', { n: 10 }), '24')
strictEqual(render('{+ 5 {* 3 7}}'), '26')
strictEqual(render('{? n 5 9}'), '9')
strictEqual(render('{?> n 5 9 14}', { n: 6 }), '9')
strictEqual(render('{for:n 5 9 14}>{n}<{rof}'), '>5<>9<>14<')
strictEqual(render('{for:n 1:2:10}{n}{rof}'), '13579')
strictEqual(render('{for 1:2:10}{n "k"}{rof}'), 'kkkkk')
strictEqual(render('{for:n val}{n}', { val: [1, 2, 3, 4] }), '1234')
strictEqual(render('{if n}{n}{else}dog{fi}'), 'dog')
strictEqual(render('{if n}{n}{else}dog{fi}', { n: 9 }), '9')
strictEqual(render('{if== n 5}dog{else}cat{fi}', { n: 9 }), 'cat')
strictEqual(render('{if~ n "string"}dog{else}cat{fi}', { n: '9' }), 'dog')
strictEqual(render('{if~ {itr n} "array"}dog{else}cat{fi}', { n: '9' }), 'dog')
strictEqual(render('{if== n 5}dog{else== n 9}cat{else}mouse{fi}', { n: 9 }), 'cat')
strictEqual(render('{nope} {lol 2}', { nope: 5, lol: a => a * 10 }), '5 20')
strictEqual(render('{lol 2}{l}{* l 4}', { lol: l => ({ l }) }), '28')
strictEqual(render('{lol "2"}{l}{* l 4}', { lol: l => ({ l }) }), '22222')
strictEqual(render('{len "" "a" "" "66"}', { len: (...l) => l.map(a => a.length) }, { separator: ',' }), '0,1,0,2')
strictEqual(render('{for:ok {?~ k "array" k {itr k}}}-{ok}{rof}', { k: 'dog' }), '-dog')
strictEqual(render('{= k {?~ k "array" k {itr k}}}{for:ok k}-{ok}{rof}', { k: 'dog' }), '-dog')
strictEqual(render('{a[].length}', { a: ['val', 'door', 'no', 'render'] }), '3, 4, 2, 6')
strictEqual(render('{a[1:2:].length}', { a: ['val', 'door', 'no', 'render'] }), '4, 6')
strictEqual(render('{a[:-1:]}', { a: [1, 2, 3, 4] }), '4, 3, 2, 1')
strictEqual(render('{|| {? dog} {? cat}}'), 'false')
strictEqual(render('{|| {? dog} {? cat}}', { dog: '' }), 'true')
strictEqual(render('{&& {? dog} {? cat}}', { dog: '' }), 'false')
strictEqual(render('{&& {? dog} {? cat}}', { dog: '', cat: '' }), 'true')
strictEqual(render('{^ {? dog} {? cat}}', { dog: '' }), 'true')
strictEqual(render('{^ {? dog} {? cat}}', { dog: '', cat: '' }), 'false')

const test = compile(`{animal 'Snail'} goes {* {+ {sound 'nope'} ' '} 2}`, { addVars: true })
strictEqual(test({ animal: 'Dog', sound: 'bark' }), 'Dog goes bark bark ')
strictEqual(test({ animal: 'Cat', sound: 'mew' }), 'Cat goes mew mew ')
strictEqual(test(), 'Snail goes nope nope ')

if (test.vars == null) throw new Error('No Vars')
strictEqual(Object.keys(test.vars).length, 0)

const testVars = compile(`{value}`, { addVars: true })
if (testVars.vars == null) throw new Error('No Vars')
strictEqual(Object.keys(testVars.vars).length, 1)
strictEqual(testVars.vars['value'], true)

doesNotReject(async () => {
    const files = await readDirFullPath('./test/files', /\.txt$/)
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('Testing', file.name)
        const fun = await compileFile(file.fullPath)
        fun({ name: 'dog', email: 'cat', fwdAdd: 'add', fwdRm: 'rm' })
    }
}, 'Test Files')

export async function readDirFullPath(path: string | string[], filter: RegExp): Promise<{ name: string, fullPath: string, reg: RegExpExecArray }[]>
export async function readDirFullPath(path: string | string[], filter?: (val: string) => boolean): Promise<{ name: string, fullPath: string }[]>
export async function readDirFullPath(paths: string | string[], filter?: RegExp | ((val: string) => boolean)) {
    const files: { name: string, fullPath: string, reg?: RegExpExecArray }[] = []
    if (typeof paths === 'string') paths = [paths]
    for (let i = 0; i < paths.length; i++) {
        const dirPath = paths[i];
        try {
            const res = await readdir(dirPath, 'utf8')
            if (filter == null) files.push(...res.map(a => ({ name: a, fullPath: path.join(dirPath, a) })))
            else if (typeof filter === 'function') files.push(...res.filter(filter).map(a => ({ name: a, fullPath: path.join(dirPath, a) })))
            else {
                for (let mi = 0; mi < res.length; mi++) {
                    const name = res[mi];
                    const reg = filter.exec(name)
                    if (reg == null) continue
                    files.push({ name, fullPath: path.join(dirPath, name), reg })
                }
            }
        } catch { }
    }
    return files
}