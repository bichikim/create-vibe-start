import {appendFile, mkdir, readFile} from 'node:fs/promises'
import {dirname} from 'node:path'

/**
 * @typedef {{bin: string, args: string[], cwd?: string, ts: string}} MockCliCall
 */

/**
 * Append one CLI invocation to the JSONL call log.
 *
 * @param {string} bin
 * @param {string[]} args
 */
export async function recordCall(bin, args) {
  const logPath = process.env.MOCK_CLI_LOG
  if (!logPath) {
    return
  }

  /** @type {MockCliCall} */
  const entry = {
    bin,
    args,
    cwd: process.cwd(),
    ts: new Date().toISOString(),
  }

  await mkdir(dirname(logPath), {recursive: true})
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
}

/**
 * Read recorded CLI calls from a JSONL log file.
 *
 * @param {string} logPath
 * @returns {Promise<MockCliCall[]>}
 */
export async function readCalls(logPath) {
  try {
    const content = await readFile(logPath, 'utf8')
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
      return []
    }
    throw error
  }
}
