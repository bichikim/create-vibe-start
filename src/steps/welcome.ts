import {confirm, intro, note} from '@clack/prompts'
import chalk from 'chalk'

export async function showWelcome() {
  intro(chalk.cyan('create-vibe-start'))

  note(
    [
      'GitHub, Vercel, Codex CLI 준비 상태를 순서대로 확인합니다.',
      '설치와 로그인은 각 CLI의 공식 흐름에 위임합니다.',
      '비밀번호나 토큰은 이 도구가 직접 입력받지 않습니다.',
    ].join('\n'),
    'AI 웹앱 개발 시작 전 준비',
  )

  return confirm({
    message: '시작할까요?',
    initialValue: true,
  })
}
