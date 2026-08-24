import type { Consideration, ExchangePolicy, ProposalAuthority, StewardDecision } from './types'

export const SAFE_AUTHORITY: ProposalAuthority = {
  inspect_public: true,
  sandbox_test: false,
  repository_read: false,
  repository_write: false,
  private_data: false,
  credential_access: false,
  production_modify: false,
  deploy: false,
  penetration_testing: false,
}

export function defaultExchangePolicy(categories: string[] = []): ExchangePolicy {
  return {
    version: '0.2',
    auto_engage: {
      enabled: true,
      max_cash: 250,
      allowed_categories: categories,
      allowed_consideration: ['cash','attribution','referral','other'],
    },
    escalation: {
      royalty: true,
      reciprocal_access: true,
      repository_write: true,
      private_data: true,
      credential_access: true,
      production_modify: true,
      deploy: true,
      penetration_testing: true,
    },
    authority_ceiling: SAFE_AUTHORITY,
    human_required_for_commitment: false,
    human_required_for_execution: true,
  }
}

export function mergeExchangePolicy(raw: unknown, categories: string[] = []): ExchangePolicy {
  const base = defaultExchangePolicy(categories)
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<ExchangePolicy>
  return {
    ...base,
    ...input,
    auto_engage: { ...base.auto_engage, ...(input.auto_engage ?? {}) },
    escalation: { ...base.escalation, ...(input.escalation ?? {}) },
    authority_ceiling: { ...base.authority_ceiling, ...(input.authority_ceiling ?? {}) },
  }
}

export function evaluateProposal(input: {
  policy: ExchangePolicy
  category: string
  consideration: Consideration[]
  requiredAuthorization: ProposalAuthority
}): StewardDecision {
  const { policy, category, consideration, requiredAuthorization: a } = input
  const reasons: string[] = []

  if (!policy.auto_engage.enabled) reasons.push('automatic engagement disabled by domain policy')
  if (policy.auto_engage.allowed_categories.length > 0 && !policy.auto_engage.allowed_categories.includes(category)) {
    reasons.push(`category '${category}' is outside the auto-engage allowlist`)
  }

  for (const item of consideration) {
    if (!policy.auto_engage.allowed_consideration.includes(item.type)) reasons.push(`${item.type} consideration requires escalation`)
    if (item.type === 'cash' && item.amount > policy.auto_engage.max_cash) reasons.push(`cash request exceeds auto-engage limit of ${policy.auto_engage.max_cash}`)
    if (item.type === 'royalty' && policy.escalation.royalty) reasons.push('royalty terms require escalation')
    if (item.type === 'reciprocal_access' && policy.escalation.reciprocal_access) reasons.push('reciprocal access requires escalation')
  }

  const authorityChecks: Array<[keyof ProposalAuthority, boolean]> = [
    ['repository_write', policy.escalation.repository_write],
    ['private_data', policy.escalation.private_data],
    ['credential_access', policy.escalation.credential_access],
    ['production_modify', policy.escalation.production_modify],
    ['deploy', policy.escalation.deploy],
    ['penetration_testing', policy.escalation.penetration_testing],
  ]
  for (const [key, escalates] of authorityChecks) if (a[key] === true && escalates) reasons.push(`${key} authority requires escalation`)
  if (a.other?.length) reasons.push('non-standard authority request requires escalation')

  if (reasons.length) {
    return {
      disposition: 'escalate',
      reasons,
      human_required: true,
      response: 'The domain agent received the contribution and preserved it for review. The proposal crosses a delegated policy boundary, so no execution authority is granted. The counterparty may continue negotiation while the required principal approval is obtained.',
    }
  }

  return {
    disposition: 'engage',
    reasons: [],
    human_required: false,
    response: 'The domain agent received the contribution and it is within the current engagement policy. The exchange is engaged. Continue with evidence or terms negotiation. Engagement is not authorization to execute, modify, test private systems, or deploy.',
  }
}
