import { NextResponse } from 'next/server'
import schema from '@/exchange-gateway/exchange.schema.json'
export function GET(){return NextResponse.json(schema,{headers:{'cache-control':'public, max-age=3600'}})}
