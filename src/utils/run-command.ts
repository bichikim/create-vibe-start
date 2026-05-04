import {execa} from 'execa'
import {log} from '@clack/prompts'

export async function runCommand(command: string, args: string[], label: string) {
  log.info(`실행: ${label}`)
  await execa(command, args, {
    stdio: 'inherit',
    preferLocal: false,
  })
}

export async function runCommandQuietly(command: string, args: string[]) {
  await execa(command, args, {
    stdio: 'pipe',
    preferLocal: false,
  })
}
