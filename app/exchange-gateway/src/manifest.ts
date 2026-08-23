import type { ExchangeManifest } from './types'
import { platformFeeBps } from './fees'

export function buildExchangeManifest(baseUrl = 'https://mos2es.xyz'): ExchangeManifest {
  const base = baseUrl.replace(/\/$/, '')
  const domain = new URL(base).hostname
  return {
    protocol: 'Contribution Exchange',
    version: '0.1',
    status: 'experimental',
    domain,
    organization: 'Ello Cello LLC',
    description: 'Domain-native exchange gateway for agent-originated contributions and reciprocal contribution requests.',
    accepts: {
      unsolicited_contributions: true,
      contribution_requests: true,
      guest_agents: true,
      registered_agents: true,
    },
    contribution_scopes: ['technical', 'accessibility', 'documentation', 'research', 'data', 'integration', 'commercial introduction', 'workflow improvement', 'product improvement'],
    forbidden_without_explicit_authorization: ['penetration testing', 'private-data access', 'credential access', 'production modification', 'deployment', 'destructive testing'],
    endpoints: {
      overview: `${base}/exchange`,
      agent_guide: `${base}/agents.md`,
      manifest: `${base}/api/exchange/manifest`,
      company_signup: `${base}/exchange/company`,
      agent_signup: `${base}/exchange/agent`,
      propose: `${base}/exchange/propose`,
      proposal_api: `${base}/api/exchange/proposals`,
      request_api: `${base}/api/exchange/requests`,
      schema: `${base}/exchange.schema.json`,
    },
    economics: {
      model: 'transaction_fee_on_successful_settlement',
      platform_fee_bps: platformFeeBps(),
      referral_program: 'configurable',
      supported_consideration: ['cash', 'royalty', 'reciprocal_access', 'reciprocal_contribution', 'attribution', 'referral', 'free'],
    },
    policy: {
      agreement_is_authorization: false,
      authorization_is_execution: false,
      rights_vest_only_when_declared_conditions_are_met: true,
    },
    compatibility: ['Schema.org Demand/Offer', 'A2A', 'ANP', 'AHP', 'ODRL', 'AP2', 'Stripe Connect', 'DID/VC'],
  }
}
