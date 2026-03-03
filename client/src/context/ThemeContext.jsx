import { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = [
  // Base
  { id: 'dark',                label: 'Dark',       bg: '#0f0f13', accent: '#8b7cf8', group: 'Base' },
  { id: 'dim',                 label: 'Dim',        bg: '#1c2128', accent: '#539bf5', group: 'Base' },
  { id: 'light',               label: 'Light',      bg: '#f4f4f8', accent: '#6366f1', group: 'Base' },
  // Gruvbox
  { id: 'gruvbox-dark',        label: 'GV Dark',    bg: '#1d2021', accent: '#d79921', group: 'Gruvbox' },
  { id: 'gruvbox-dim',         label: 'GV Dim',     bg: '#282828', accent: '#b8bb26', group: 'Gruvbox' },
  { id: 'gruvbox-light',       label: 'GV Light',   bg: '#f9f5d7', accent: '#9d0006', group: 'Gruvbox' },
  // Catppuccin
  { id: 'catppuccin-mocha',    label: 'Mocha',      bg: '#1e1e2e', accent: '#cba6f7', group: 'Catppuccin' },
  { id: 'catppuccin-macchiato',label: 'Macchiato',  bg: '#24273a', accent: '#c6a0f6', group: 'Catppuccin' },
  { id: 'catppuccin-frappe',   label: 'Frappé',     bg: '#303446', accent: '#ca9ee6', group: 'Catppuccin' },
  { id: 'catppuccin-latte',    label: 'Latte',      bg: '#eff1f5', accent: '#8839ef', group: 'Catppuccin' },
  // Editor
  { id: 'monokai',             label: 'Monokai',    bg: '#272822', accent: '#66d9ef', group: 'Editor' },
  { id: 'dracula',             label: 'Dracula',    bg: '#282a36', accent: '#bd93f9', group: 'Editor' },
  { id: 'nord',                label: 'Nord',       bg: '#2e3440', accent: '#88c0d0', group: 'Editor' },
  { id: 'tokyo-night',         label: 'Tokyo Night',bg: '#1a1b26', accent: '#7aa2f7', group: 'Editor' },
]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = useState(
    () => localStorage.getItem('booked-theme') || 'dark'
  )

  const setTheme = (id) => {
    setThemeRaw(id)
    localStorage.setItem('booked-theme', id)
    document.documentElement.setAttribute('data-theme', id)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
