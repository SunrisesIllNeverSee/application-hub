import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { appendExchangeEvent, authenticateCompany, authenticateProposer, getExchangeAdmin, requestIdentity } from '@/lib/exchange/server'
import { rateLimitAllow } from '@/lib/rate-limit'
const MessageSchema=z.object({text:z.string().trim().min(1).max(10000)})
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!rateLimitAllow(requestIdentity(req),'exchange_message')) return NextResponse.json({error:'Rate limited'},{status:429})
  const publicId=(await params).id; const parsed=MessageSchema.safeParse(await req.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid message'},{status:400})
  const admin=getExchangeAdmin(); const {data:record}=await admin.from('exchange_records').select('*').eq('public_id',publicId).maybeSingle(); if(!record)return NextResponse.json({error:'Exchange not found'},{status:404})
  const company=await authenticateCompany(record.target_domain,req.headers.get('x-exchange-company-key')); const proposer=authenticateProposer(record,req.headers.get('x-exchange-proposer-key')); const role=company?'company':proposer?'proposer':null; if(!role)return NextResponse.json({error:'Unauthorized'},{status:401})
  await appendExchangeEvent({exchangeId:record.id,eventType:'message',actor:{type:role,id:role},fromState:record.state,toState:record.state,payload:{text:parsed.data.text}})
  return NextResponse.json({sent:true},{status:201})
}
