import type { CSSProperties } from 'react'

/** Qunli colors are palette tokens such as "yellow2": a hue plus a 1–4 strength. */
const HUES: Record<string, string> = {
  gray: '#9ca3af',
  grey: '#9ca3af',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  pink: '#ec4899',
  purple: '#a855f7',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  green: '#22c55e',
  lime: '#84cc16',
  brown: '#a16207'
}

const TINT_BY_LEVEL = [16, 22, 30, 38]

function parseQunliColor(color: string | null | undefined): { hue: string; level: number } | null {
  const match = /^([a-z]+)([1-4])?$/i.exec(color?.trim() ?? '')
  const hue = match ? HUES[match[1].toLowerCase()] : undefined
  if (hue) {
    return { hue, level: Number(match?.[2] ?? 2) }
  }
  return color && /^#[0-9a-f]{3,8}$/i.test(color.trim()) ? { hue: color.trim(), level: 2 } : null
}

export function qunliTintStyle(color: string | null | undefined): CSSProperties | undefined {
  const parsed = parseQunliColor(color)
  return parsed
    ? {
        backgroundColor: `color-mix(in srgb, ${parsed.hue} ${TINT_BY_LEVEL[parsed.level - 1]}%, transparent)`
      }
    : undefined
}

export function qunliDotStyle(color: string | null | undefined): CSSProperties | undefined {
  const parsed = parseQunliColor(color)
  return parsed ? { backgroundColor: parsed.hue } : undefined
}
