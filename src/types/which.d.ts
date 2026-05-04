declare module 'which' {
  export default function which(command: string): Promise<string>
}
