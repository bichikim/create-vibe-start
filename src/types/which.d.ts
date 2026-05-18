declare module 'which' {
  /**
   * PATH에서 명령 실행 파일을 찾아 절대 경로를 반환합니다.
   *
   * @param command - 찾을 명령 이름입니다.
   */
  export default function which(command: string): Promise<string>
}
