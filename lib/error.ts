import { PathObj } from '../pathInterpreter'
import { TemplatePosition } from './types'

export class InvalidPathError extends Error {
    constructor(public path: string, { lineNum, charNum, file }: TemplatePosition, title?: string) {
        super(title ?? `The path ${path} is invalid (${file != null ? file.name + ':' : ''}${lineNum}:${charNum})`)
    }
}

export class MissingKeyValueError extends Error {
    key: string
    constructor({ path, position: { lineNum, charNum, file } }: PathObj, title?: string) {
        super(title ?? `Missing Value for Key "${path}" (${file != null ? file.name + ':' : ''}${lineNum}:${charNum})`)
        this.key = path
    }
}