# Text Template Generator
A personal project that does not use any external code and does not evaluate any JS code

## Usage
```js
import * as text from 'text_template'

// Loads a file and compiles it
const render = await text.compileFile('path.txt', options)
// Compiles template as it receives it from the stream
const render = await text.compileStream(stream, options)
// Compiles template that was passed as a string
const render = text.compile('Template String', options)

// Renders the template
const output = render({ vars: 'anything' })
// Compiles then renders the template supplied as a string
const output = text.render('Template String', { vars: 'anything' }, options)
```

## Options
- `defaults`
    - Default variables that can ve overwritten by those passed to render
- `defaultFunction`
    - `(key, ...args) => {}`
    - First arguments is a string
- `separator`
    - All script blocks that return to the template a non string iterable value will have the value joined with this separator
- `maxIterations`
    - Limits the maximum number of iterations of for loops
- `allowKeyBlocks`
    - By default all script block are not allowed to have a script block as the first argument (key)
- `nullOnMissing`
    - By default all keys that do not have a value or return null will throw `MissingKeyValueError`
- `setFunctionThis`
    - If true, all functions will have `this` bound to the variable object
- `addVars`
    - Adds `.vars` property to render functions with an object containing required keys
    - This is not reliable as it does not run the script blocks  
- `filePath`
    - Adds the supplied filepath to all instances of `InvalidPathError` and `MissingKeyValueError`

## Format
Consists of text with code blocks in the format of\
`{key ...args}`

Arguments can be:
- **variable name**
    - Regular
        - `a`
    - Object Paths
        - `a.length`
    - Indexes
        - `a[0]`
    - Expansion
        - `a[]`
            - Equivalent to in JS `[...a]`
    - Ranges
        - Follows `start:increment:end`
        - `a[1:4]`
        - `a[:-1:]` 
            - Equivalent to the JS method `a.reverse()`
    - And any mix
        - `a[1:4].length`
            - Returns the lengths of values of `a[1]` to `a[4]`
            - **Important** `a[1:4].length[0]` will return an error as `a[1].length[0]` is not valid unless the length property is iterable
- **Values**
    - Number
        - `15`
        - `0xf`
        - `0b1111`
    - Boolean
        - `false`
    - String
        - `'string'`
        - Must be quoted
- **Ranges**
    - `1:8`
        - Useful as values for `for`
- **Function Keys**
    - Function arguments will be those that  follow the key
    - If the returned value is a non iterable object, then its keys will be added to the variables
- **Script Block**
    - `{= a {+ 1 2 3}}`
        - Sets the result of the summation into `a`

The following are predefined
```
{key} returns variable
{key default} returns variable if exists else returns the default
{functionKey ...args} Runs function
{= key args} Sets Key
{= key ...args} Sets Array to key
{=? key args} Sets variable if not set
{? key} Return true of key exists
{?<condition> left right} Return result of condition
{? key ifExists ifNotExists} Ternary if exists
{?<condition> left right ifExists ifNotExists} Ternary
{+ ...args} Sums args
{- ...args} Subtracts followup arguments from first
{* ...args} Multiplies args
{/ ...args} Divides args
{itr ...args} Coverts args to single iterable object
{if key} Starts if block if key exists
{if<condition> left right} Starts if block if condition is true
{else key} Starts Else If block
{else<condition> left right} Starts Else if Block 
{else} Starts Else block
{fi} Ends If
{for:varKey key} Starts For each. Iterates over values of key
{for:varKey ...args} Start For Each. Iterates over all args
{rof} Ends For Each
```
### Valid conditions
- `<`   Less than
- `<=`  Less or equal
- `>`   Greater than
- `>=`  Greater oe equal
- `==`  Equal
- `~`   Type test
    - `string`
    - `number`
    - `boolean`
    - `array`

### Example
```
{=? animals {itr}}
{= len animals.length}
Hello {name 'No Name'},
{if> len 0}
You have {len} animal{?== len 1 's'}
{for:name animals}
    - A {name}
{rof}
Their letter counts sum to {+ animals[].length} with minimum being {min animals[].length}
{else}
Your animals ran away
{fi}
```

```js
const renderer = await text.compileFile('file.txt', { defaults: { min: a => Math.min(...a) } })
const result = render({ name: 'Joe', animals: ['dog', 'cat', 'mouse'] })
/*
render =
`Hello Joe,
You have 3 animals
    - A dog
    - A cat
    - A mouse`
Their letter counts sum to 11 with minimum being 3
*/
const result2 = render({ name: 'Moe' })
/*
result2 = 
`Hello Moe,
Your animals ran away
*/
```
