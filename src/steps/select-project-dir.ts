import {existsSync, statSync} from 'node:fs'
import {resolve} from 'node:path'
import {confirm, isCancel, log, text} from '@clack/prompts'

type SelectProjectDirOptions = {
  baseDir?: string
  defaultDir?: string
}

export async function selectProjectDir(options: SelectProjectDirOptions = {}): Promise<string | null> {
  const baseDir = options.baseDir ?? process.cwd()
  const defaultDir = options.defaultDir ?? '.'
  const answer = await text({
    message: '프로젝트 작업 폴더를 입력해주세요.',
    placeholder: defaultDir,
    initialValue: defaultDir,
  })

  if (isCancel(answer)) {
    return null
  }

  const input = answer.trim() || defaultDir
  const projectDir = resolve(baseDir, input)

  if (!existsSync(projectDir)) {
    return projectDir
  }

  if (!statSync(projectDir).isDirectory()) {
    log.error('작업 폴더가 아닌 파일 경로입니다.')
    return null
  }

  const shouldUseExistingDir = await confirm({
    message: '이미 있는 폴더입니다. 기존 폴더 내용을 수정 또는 삭제할 수 있습니다. 정말 여기서 작업할까요?',
    initialValue: true,
  })

  return isCancel(shouldUseExistingDir) || !shouldUseExistingDir ? null : projectDir
}
