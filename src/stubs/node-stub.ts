// Stub for Node.js built-ins that the Anthropic SDK credential chain imports.
// These code paths are never reached in browser mode.
export default {}
export const readFileSync = () => { throw new Error('not available in browser') }
export const existsSync = () => false
export const join = (...parts: string[]) => parts.join('/')
export const resolve = (...parts: string[]) => parts.join('/')
export const homedir = () => '/'
