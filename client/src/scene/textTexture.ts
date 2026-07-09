import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

export interface LabelOpts {
  fg?: string
  bg?: string
  w?: number
  h?: number
  fontPx?: number
  bold?: boolean
}

/**
 * Draws text onto a canvas texture. Avoids any font/CDN fetching (works
 * offline and in headless browsers) — system fonts only.
 */
export function labelTexture(text: string, opts: LabelOpts = {}): THREE.CanvasTexture {
  const { fg = '#ffffff', bg = 'transparent', w = 256, h = 128, fontPx = 72, bold = true } = opts
  const key = JSON.stringify([text, fg, bg, w, h, fontPx, bold])
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (bg !== 'transparent') {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }
  ctx.fillStyle = fg
  ctx.font = `${bold ? '900 ' : ''}${fontPx}px system-ui, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // shrink to fit
  let size = fontPx
  while (ctx.measureText(text).width > w * 0.92 && size > 10) {
    size -= 4
    ctx.font = `${bold ? '900 ' : ''}${size}px system-ui, Arial, sans-serif`
  }
  ctx.fillText(text, w / 2, h / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  cache.set(key, tex)
  return tex
}
