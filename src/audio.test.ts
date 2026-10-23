import { describe, expect, it } from 'vitest'
import { makeWav } from './audio'

describe('makeWav', () => {
  it('16-bit mono PCM としてサンプルを保存する', async () => {
    const blob = makeWav(new Float32Array([-40000, -200, 0, 200, 40000]), 48000)
    const data = await blob.arrayBuffer()
    const view = new DataView(data)
    expect(blob.type).toBe('audio/wav')
    expect(new TextDecoder().decode(data.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(data.byteLength - 8)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getUint32(40, true)).toBe(10)
    expect(Array.from({ length: 5 }, (_, index) => view.getInt16(44 + index * 2, true))).toEqual([-32768, -200, 0, 200, 32767])
  })
})
