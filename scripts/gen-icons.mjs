// 生成 PWA 图标（纯 Node，无第三方依赖）：与 favicon.svg 同款的点划图案
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

function png(size, path) {
  const W = size
  const H = size
  const stride = W * 4 + 1
  const bytes = Buffer.alloc(stride * H)
  const scale = size / 64

  const put = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * stride + 1 + x * 4
    bytes[i] = r
    bytes[i + 1] = g
    bytes[i + 2] = b
    bytes[i + 3] = a
  }

  const rad = 14 * scale
  for (let y = 0; y < H; y++) {
    bytes[y * stride] = 0 // filter: none
    for (let x = 0; x < W; x++) {
      let inside = true
      const cx = Math.min(x, W - 1 - x)
      const cy = Math.min(y, H - 1 - y)
      if (cx < rad && cy < rad) {
        const dx = rad - cx
        const dy = rad - cy
        inside = dx * dx + dy * dy <= rad * rad
      }
      if (inside) put(x, y, 0x2f, 0x6f, 0xed)
      else put(x, y, 0, 0, 0, 0)
    }
  }

  const rect = (x, y, w, h, r, g, b) => {
    for (let yy = Math.round(y * scale); yy < Math.round((y + h) * scale); yy++)
      for (let xx = Math.round(x * scale); xx < Math.round((x + w) * scale); xx++)
        put(xx, yy, r, g, b)
  }
  // 上行：点 + 划；下行：划 + 点
  rect(12, 20, 10, 10, 255, 255, 255)
  rect(27, 20, 25, 10, 255, 255, 255)
  rect(12, 36, 25, 10, 0x9d, 0xc0, 0xfb)
  rect(42, 36, 10, 10, 0x9d, 0xc0, 0xfb)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const t = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
    return Buffer.concat([len, t, data, crc])
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const idat = deflateSync(bytes, { level: 9 })
  const out = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  writeFileSync(path, out)
  console.log('written', path, out.length, 'bytes')
}

png(192, 'public/pwa-192x192.png')
png(512, 'public/pwa-512x512.png')
