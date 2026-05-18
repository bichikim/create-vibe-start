import which from 'which'

/**
 * 현재 PATH에서 명령 실행 파일을 찾을 수 있는지 확인합니다.
 *
 * @param command - 확인할 명령 이름입니다.
 * @returns 명령을 찾으면 `true`, 찾지 못하면 `false`입니다.
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    await which(command)
    return true
  } catch {
    return false
  }
}
