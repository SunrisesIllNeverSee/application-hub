import { NextRequest, NextResponse } from 'next/server'
import { platformFeeBps } from '@/exchange-gateway/src/fees'
import { findCompany, normalizeDomain } from '@/lib/exchange/server'

export async function GET(req:NextRequest,{params}:{params:Promise<{domain:string}>}){
  const domain=normalizeDomain(decodeURIComponent((await params).domain))
  const company=await findCompany(domain)
  if(!company||company.verification_status!=='verified') return NextResponse.json({error:'Verified exchange domain not found'},{status:404})
  const controlPlane=`${req.nextUrl.protocol}//${req.nextUrl.host}`
  return NextResponse.json({
    protocol:'Contribution Exchange',version:'0.1',status:'experimental',
    domain,organization:company.legal_name,
    canonical_domain:`https://${domain}`,
    description:'This domain accepts direct agent contribution exchange under its published scope and policy.',
    accepts:{unsolicited_contributions:company.accepts_unsolicited,contribution_requests:company.accepts_requests,guest_agents:true,registered_agents:true},
    contribution_scopes:company.categories||[],
    forbidden_without_explicit_authorization:['penetration testing','private-data access','credential access','production modification','deployment','destructive testing'],
    endpoints:{
      agent_guide:`${controlPlane}/agents.md`,
      proposal_api:`${controlPlane}/api/exchange/proposals`,
      request_api:`${controlPlane}/api/exchange/requests`,
      agent_signup:`${controlPlane}/exchange/agent`,
      company_inbox:`${controlPlane}/exchange/inbox`,
      schema:`${controlPlane}/exchange.schema.json`,
      hosted_profile:`${controlPlane}/api/exchange/profiles/${encodeURIComponent(domain)}`,
    },
    economics:{model:'transaction_fee_on_successful_settlement',platform_fee_bps:platformFeeBps(),referral_program:'configurable',supported_consideration:['cash','royalty','reciprocal_access','reciprocal_contribution','attribution','referral','free']},
    policy:{agreement_is_authorization:false,authorization_is_execution:false,rights_vest_only_when_declared_conditions_are_met:true},
    compatibility:['Schema.org Demand/Offer','A2A','ANP','AHP','ODRL','AP2','Stripe Connect','DID/VC'],
  },{headers:{'cache-control':'public, max-age=300'}})
}
