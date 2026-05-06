import {join} from 'node:path'
import {log} from '@clack/prompts'
import nodePlop from 'node-plop'
import chalk from 'chalk'

export async function generateTemplate(projectDir: string) {
  log.step(chalk.bold('프로젝트 템플릿 생성'))

  const plop = await nodePlop()
  const generator = plop.setGenerator('vibe-start', {
    description: 'Create the initial vibe project files.',
    prompts: [],
    actions: [
      {
        type: 'add',
        path: join(projectDir, 'README.md'),
        template: '# hellow vibe code\n',
        force: true,
      },
    ],
  })
  const result = await generator.runActions({})

  if (result.failures.length > 0) {
    throw new Error(result.failures.map((failure) => failure.error || failure.message).join('\n'))
  }

  log.message(chalk.green(`README.md 생성 완료: ${projectDir}`))
}
