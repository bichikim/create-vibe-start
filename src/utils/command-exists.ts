import which from 'which'

export async function commandExists(command: string): Promise<boolean> {
  try {
    await which(command)
    return true
  } catch {
    return false
  }
}
