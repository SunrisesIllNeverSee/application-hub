import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'AQUA Application Hub'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          color: '#f5f5f5',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }}>AQUA Application Hub</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 0.95, fontWeight: 800, letterSpacing: '-0.05em' }}>Applications.</div>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 0.95, fontWeight: 800, letterSpacing: '-0.05em' }}>Questions. Answers.</div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 28, color: '#a3a3a3' }}>Reusable application infrastructure · mos2es.xyz</div>
        </div>
      </div>
    ),
    size
  )
}
