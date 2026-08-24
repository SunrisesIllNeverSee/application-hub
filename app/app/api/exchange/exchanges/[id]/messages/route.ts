import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { appendExchangeEvent, authenticateCompany, authenticateDomainAgent, authenticateProposer, getExchangeAdmin, requestIdentity } from '@/lib/exchange/server'
import { rateLimitAllow } from '@/lib/rate-limit'
const MessageSchema=z.object({text:z.string().trim().min(1).max(10000)})
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!rateLimitAllow(requestIdentity(req),'exchange_message')) return NextResponse.json({error:'Rate limited'},{status:429})
  const publicId=(await params).id
  const parsed=MessageSchema.safeParse(await req.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Invalid message'},{status:400})
  const admin=getExchangeAdmin()
  const {data:record}=await admin.from('exchange_records').select('*').eq('public_id',publicId).maybeSingle()
  if(!record)return NextResponse.json({error:'Exchange not found'},{status:404})
  const company=await authenticateCompany(record.target_domain,req.headers.get('x-exchange-company-key'))
  const domainAgent=await authenticateDomainAgent(record.target_domain,req.headers.get('x-exchange-domain-agent-key'))
  const proposer=authenticateProposer(record,req.headers.get('x-exchange-proposer-key'))
  const role=company?'company_admin':domainAgent?'domain_agent':proposer?'proposer':null
  if(!role)return NextResponse.json({error:'Unauthorized'},{status:401})
  const actor=role==='domain_agent'?{type:'agent',id:`domain-agent:${record.target_domain}`}:{type:role==='proposer'?'agent':'human',id:role}
  await appendExchangeEvent({exchangeId:record.id,eventType:'message',actor,fromState:record.state,toState:record.state,payload:{text:parsed.data.text}})
  return NextResponse.json({sent:true,actor:role},{status:201})
}
