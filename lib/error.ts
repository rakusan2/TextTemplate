import { PathObj } from '../pathInterpreter'
import { TemplatePosition } from './types'

export class InvalidPathError extends Error {
    constructor(public path: string, public position: TemplatePosition, title?: string) {
        super(title ?? `The path ${path} is invalid (${position.file != null ? position.file.name + ':' : ''}${position.lineNum}:${position.charNum})`)
    }
}

export class MissingKeyValueError extends Error {
    key: string
    position: TemplatePosition
    constructor({ path, position: { lineNum, charNum, file } }: PathObj, title?: string) {
        super(title ?? `Missing Value for Key "${path}" (${file != null ? file.name + ':' : ''}${lineNum}:${charNum})`)
        this.key = path
        this.position = { lineNum, charNum, file }
    }
}