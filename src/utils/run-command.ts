import {execa} from 'execa'
import {log} from '@clack/prompts'

/**
 * 사용자에게 표시할 라벨을 출력한 뒤 명령을 상호작용 모드로 실행합니다.
 *
 * @param command - 실행할 명령입니다.
 * @param args - 명령에 전달할 인수 목록입니다.
 * @param label - 사용자에게 표시할 실행 설명입니다.
 */
export async function runCommand(command: string, args: string[], label: string) {
  log.info(`실행: ${label}`)
  await execa(command, args, {
    stdio: 'inherit',
    preferLocal: false,
  })
}

/**
 * 명령 출력 없이 외부 명령을 실행합니다.
 *
 * @param command - 실행할 명령입니다.
 * @param args - 명령에 전달할 인수 목록입니다.
 */
export async function runCommandQuietly(command: string, args: string[]) {
  await execa(command, args, {
    stdio: 'pipe',
    preferLocal: false,
  })
}
