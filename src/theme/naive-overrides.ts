import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * 把 naive-ui 的圆角、阴影、彩色主色压回 tokens.css 定义的形状与色板。
 * 与 Renko6626.github.io 的同名文件同源，并补上工具站会用到的输入类组件。
 *
 * naive-ui 要做颜色运算，不吃 `var(--x)`，所以这里写字面量，集中在 TOKEN 里。
 */
const TOKEN = {
  bg: '#000000',
  raise: '#0c0c0d',
  hairline: '#2a2a2c',
  line: '#45454a',
  mute: '#8a8a90',
  text: '#eceef2',
} as const

const FONT_BODY =
  "'IBM Plex Sans', 'IBM Plex Sans SC', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', system-ui, sans-serif"
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace"

export const naiveOverrides: GlobalThemeOverrides = {
  common: {
    baseColor: TOKEN.bg,
    bodyColor: TOKEN.bg,
    cardColor: TOKEN.bg,
    modalColor: TOKEN.raise,
    popoverColor: TOKEN.raise,
    tableColor: TOKEN.bg,
    inputColor: TOKEN.bg,
    textColorBase: TOKEN.text,
    textColor1: TOKEN.text,
    textColor2: TOKEN.text,
    textColor3: TOKEN.mute,
    placeholderColor: TOKEN.line,
    borderColor: TOKEN.hairline,
    dividerColor: TOKEN.hairline,
    borderRadius: '0px',
    borderRadiusSmall: '0px',
    fontFamily: FONT_BODY,
    fontFamilyMono: FONT_MONO,
    fontSize: '1rem',
    // 主色不用红：accent 只留给一个点。交互态靠亮度与边框区分。
    primaryColor: TOKEN.text,
    primaryColorHover: '#ffffff',
    primaryColorPressed: TOKEN.mute,
    primaryColorSuppl: TOKEN.text,
    boxShadow1: 'none',
    boxShadow2: 'none',
    boxShadow3: 'none',
  },
  Button: {
    borderRadiusTiny: '0px',
    borderRadiusSmall: '0px',
    borderRadiusMedium: '0px',
    borderRadiusLarge: '0px',
    color: 'transparent',
    textColor: TOKEN.text,
    border: `1px solid ${TOKEN.line}`,
    borderHover: `1px solid ${TOKEN.text}`,
    borderPressed: `1px solid ${TOKEN.text}`,
    borderFocus: `1px solid ${TOKEN.text}`,
    textColorHover: TOKEN.text,
    textColorPressed: TOKEN.mute,
    textColorFocus: TOKEN.text,
    colorHover: TOKEN.raise,
    colorPressed: TOKEN.bg,
    colorFocus: TOKEN.bg,
    // type="primary"：实心反白，是页面上唯一的「主操作」
    colorPrimary: TOKEN.text,
    colorHoverPrimary: '#ffffff',
    colorPressedPrimary: TOKEN.mute,
    colorFocusPrimary: '#ffffff',
    textColorPrimary: TOKEN.bg,
    textColorHoverPrimary: TOKEN.bg,
    textColorPressedPrimary: TOKEN.bg,
    textColorFocusPrimary: TOKEN.bg,
    borderPrimary: `1px solid ${TOKEN.text}`,
    borderHoverPrimary: '1px solid #ffffff',
    borderPressedPrimary: `1px solid ${TOKEN.mute}`,
    borderFocusPrimary: '1px solid #ffffff',
    fontWeight: '500',
    paddingMedium: '0 20px',
    heightMedium: '40px',
  },
  Input: {
    borderRadius: '0px',
    color: TOKEN.bg,
    colorFocus: TOKEN.bg,
    border: `1px solid ${TOKEN.line}`,
    borderHover: `1px solid ${TOKEN.text}`,
    borderFocus: `1px solid ${TOKEN.text}`,
    boxShadowFocus: 'none',
    caretColor: TOKEN.text,
  },
  Tag: {
    borderRadius: '0px',
    color: 'transparent',
    border: `1px solid ${TOKEN.hairline}`,
    textColor: TOKEN.mute,
    fontFamily: FONT_MONO,
    heightSmall: '24px',
  },
  Card: {
    borderRadius: '0px',
    borderColor: TOKEN.hairline,
  },
  Message: {
    borderRadius: '0px',
    color: TOKEN.raise,
    textColor: TOKEN.text,
    boxShadow: `0 0 0 1px ${TOKEN.line}`,
  },
  Dialog: {
    borderRadius: '0px',
    color: TOKEN.raise,
  },
}
