import { pathToFileURL } from 'node:url'
import path from 'node:path'

// Tests import the same TypeScript/React modules as Next through Node's tsx loader.
export async function createModuleLoader() {
  return {
    load: modulePath => import(pathToFileURL(path.resolve(modulePath.replace(/^\//, ''))).href),
    close: async () => {},
  }
}
