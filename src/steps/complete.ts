import {log, outro} from '@clack/prompts'
import chalk from 'chalk'
import type {SetupResult} from './setup-tool'

/**
 * 각 준비 단계의 결과를 출력하고 최종 완료 메시지를 표시합니다.
 *
 * @param results - 실행한 준비 단계들의 결과입니다.
 */
export function showComplete(results: SetupResult[]) {
  log.step(chalk.bold('준비 결과'))

  for (const result of results) {
    const icon = result.status === 'ready' ? '✔' : result.status === 'skipped' ? '↷' : '!'
    const color = result.status === 'ready' ? chalk.green : result.status === 'skipped' ? chalk.yellow : chalk.red
    log.message(color(`${icon} ${result.name}: ${result.message}`))
  }

  const allReady = results.every((result) => result.status === 'ready')
  outro(
    allReady
      ? chalk.green('계정 준비 완료')
      : chalk.yellow('완료되지 않은 단계가 있습니다. 필요할 때 다시 실행해주세요.'),
  )
}
