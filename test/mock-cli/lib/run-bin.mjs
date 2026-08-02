import {recordCall} from './record.mjs'
import {handleScenario} from './scenario.mjs'

/**
 * Run a mock CLI binary with the given args.
 *
 * @param {string} bin
 * @param {string[]} args
 */
export async function runMockCli(bin, args) {
  await recordCall(bin, args)
  const result = await handleScenario(bin, args)

  if (result.stdout) {
    process.stdout.write(`${result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`}`)
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`}`)
  }

  process.exitCode = result.exitCode
}
