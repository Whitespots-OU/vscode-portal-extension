export const getIsDark = (): boolean => {
  return document.body.getAttribute('data-vscode-theme-kind')?.includes('dark') ?? false
}

export const appendDarkMode = () => {
  if (getIsDark()) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
