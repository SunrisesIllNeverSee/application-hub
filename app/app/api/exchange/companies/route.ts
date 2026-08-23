import { NextRequest, NextResponse } from 'next/server'
import { CompanyRegistrationSchema } from '@/exchange-gateway/src/schema'
import { getExchangeAdmin, hashSecret, newSecret, normalizeDomain, requestIdentity } from '@/lib/exchange/server'
import { rateLimitAllow } from '@/lib/rate-limit'

export async function POST(req: NextRequest){
  if(!rateLimitAllow(requestIdentity(req),'exchange_company_signup')) return NextResponse.json({error:'Rate limited'},{status:429})
  const parsed = CompanyRegistrationSchema.safeParse(await req.json().catch(()=>null)); if(!parsed.success) return NextResponse.json({error:'Invalid company registration',details:parsed.error.flatten()},{status:400})
  const p=parsed.data; if(p.honeypot) return NextResponse.json({error:'Rejected'},{status:400})
  const admin=getExchangeAdmin(); const domain=normalizeDomain(p.domain)
  const {data:existing}=await admin.from('exchange_companies').select('id,verification_status').eq('domain',domain).maybeSingle(); if(existing) return NextResponse.json({error:'Domain already registered',status:existing.verification_status},{status:409})
  const companyKey=newSecret('company'); const verificationToken=newSecret('verify')
  const {data,error}=await admin.from('exchange_companies').insert({legal_name:p.legalName,domain,contact_name:p.contactName,contact_email:p.contactEmail,country:p.country,address:{addressLine1:p.addressLine1,city:p.city,region:p.region,postalCode:p.postalCode},verification_token:verificationToken,admin_key_hash:hashSecret(companyKey),accepts_unsolicited:p.acceptsUnsolicited,accepts_requests:p.acceptsRequests,categories:p.categories}).select('id,domain,verification_status').single()
  if(error) return NextResponse.json({error:'Registration failed'},{status:500})
  return NextResponse.json({company:data,company_admin_key:companyKey,warning:'Save this key now; only its hash is stored.',dns:{name:`_contribution-exchange.${domain}`,type:'TXT',value:`cx-verification=${verificationToken}`}}, {status:201})
}
