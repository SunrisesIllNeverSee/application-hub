import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const stat = searchParams.get('stat')     // e.g. "25 questions answered"
  const name = searchParams.get('name')     // optional username

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top — logo mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              fontSize: '52px',
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: '-2px',
              lineHeight: 1,
            }}
          >
            MO§ES™
          </div>
          <div
            style={{
              width: '1px',
              height: '40px',
              background: '#333',
            }}
          />
          <div
            style={{
              fontSize: '22px',
              fontWeight: '500',
              color: '#888',
              letterSpacing: '-0.5px',
            }}
          >
            Application Hub
          </div>
        </div>

        {/* Center — main message */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {stat ? (
            <>
              <div
                style={{
                  fontSize: '62px',
                  fontWeight: '700',
                  color: '#ffffff',
                  letterSpacing: '-2px',
                  lineHeight: 1.05,
                }}
              >
                {stat}
              </div>
              {name && (
                <div style={{ fontSize: '24px', color: '#666', fontWeight: '400' }}>
                  {name} · mos2es.xyz
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: '58px',
                  fontWeight: '700',
                  color: '#ffffff',
                  letterSpacing: '-2px',
                  lineHeight: 1.1,
                  maxWidth: '900px',
                }}
              >
                The question archive for every application you&apos;ll ever write.
              </div>
              <div style={{ fontSize: '24px', color: '#666', fontWeight: '400' }}>
                Answer once. Apply everywhere.
              </div>
            </>
          )}
        </div>

        {/* Bottom — URL + accent */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '22px', color: '#3b82f6', fontWeight: '500', letterSpacing: '-0.3px' }}>
            mos2es.xyz
          </div>
          <div
            style={{
              fontSize: '96px',
              fontWeight: '800',
              color: '#1a1a2e',
              letterSpacing: '-4px',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            §
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
