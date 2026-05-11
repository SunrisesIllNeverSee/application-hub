import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// POST /api/teams — create a team (owner must be on 'team' tier)
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is on team tier
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single()

    if (subscription?.tier !== 'team') {
      return NextResponse.json(
        { error: 'Team features require the Team plan.' },
        { status: 403 }
      )
    }

    const body = await req.json() as { name?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'name must be 80 characters or fewer' }, { status: 400 })
    }

    // Check if user already owns a team
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (existingTeam) {
      return NextResponse.json(
        { error: 'You already own a team. Each account may own one team.' },
        { status: 409 }
      )
    }

    // Generate a unique slug
    const baseSlug = slugify(name) || 'team'
    let slug = baseSlug
    let attempt = 0
    while (attempt < 10) {
      const { data: conflict } = await supabase
        .from('teams')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!conflict) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Insert team + owner membership in a transaction-like sequence
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .insert({ name, slug, owner_id: user.id })
      .select('id, name, slug, owner_id, plan, created_at')
      .single()

    if (teamErr || !team) {
      console.error('[POST /api/teams] insert error:', teamErr)
      return NextResponse.json({ error: teamErr?.message ?? 'Failed to create team' }, { status: 500 })
    }

    const { error: memberErr } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (memberErr) {
      console.error('[POST /api/teams] member insert error:', memberErr)
      // Team was created — still return it but log the inconsistency
    }

    return NextResponse.json({ team }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/teams]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/teams — list teams the authenticated user belongs to
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: memberships, error } = await supabase
      .from('team_members')
      .select('role, joined_at, team:teams(id, name, slug, owner_id, plan, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const teams = (memberships ?? []).map((m) => {
      const t = Array.isArray(m.team) ? m.team[0] : m.team
      return { ...(t as Record<string, unknown>), member_role: m.role }
    })

    return NextResponse.json({ teams })

  } catch (err) {
    console.error('[GET /api/teams]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
