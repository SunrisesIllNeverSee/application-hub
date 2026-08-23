import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8')

test('portable package contains the state-bearing commitment fields',()=>{const types=read('exchange-gateway/src/types.ts'); for(const token of ['contribution_id','consideration','rights','vesting','authorization','verification','settlement','revocation','provenance']) assert.match(types,new RegExp(token))})

test('state machine separates agreement, authorization, delivery, verification and settlement',()=>{const sm=read('exchange-gateway/src/state-machine.ts'); for(const state of ['committed','authorized','delivering','delivered','verified','settled']) assert.match(sm,new RegExp(state)); assert.match(sm,/to === 'settled'.*system/s)})

test('example commitment preserves cash royalty reciprocal access and pre/post vesting rights',()=>{const example=JSON.parse(read('exchange-gateway/examples/contribution-commitment.json')); assert.equal(example.origin.type,'ambient_observation'); assert.ok(example.consideration.some(x=>x.type==='cash')); assert.ok(example.consideration.some(x=>x.type==='royalty')); assert.ok(example.consideration.some(x=>x.type==='reciprocal_access')); assert.equal(example.rights.pre_vesting.deploy,'prohibited'); assert.equal(example.rights.post_vesting.deploy,'permitted')})

test('well-known profile engages guest agents without implying execution permission',()=>{const manifest=JSON.parse(read('public/.well-known/exchange.json')); assert.equal(manifest.accepts.guest_agents,true); assert.equal(manifest.accepts.unsolicited_contributions,true); assert.equal(manifest.policy.agreement_is_authorization,false); assert.equal(manifest.policy.authorization_is_execution,false)})

test('database migration is private-by-default and includes settlement/event lineage',()=>{const sql=read('../supabase/migrations/202608230001_contribution_exchange.sql'); assert.match(sql,/enable row level security/gi); assert.match(sql,/revoke all on table public\.exchange_records from anon, authenticated/i); assert.match(sql,/exchange_events/); assert.match(sql,/exchange_settlements/); assert.match(sql,/commitment_acceptances/); assert.match(sql,/exchange_records_company_idx/)})

test('agent brochure explicitly differentiates the gateway from nearby systems',()=>{const guide=read('../docs/exchange/AGENT_BROCHURE.md'); for(const phrase of ['Not a job board','Not only a bug bounty','Not a replacement for A2A/ANP/AHP','Not only payments']) assert.match(guide,new RegExp(phrase))})

test('cash settlement preserves the transaction-fee model',()=>{const source=read('app/api/exchange/exchanges/[id]/settle/route.ts'); assert.match(source,/record\.state!=='verified'/); assert.match(source,/calculateFees/); assert.match(source,/application_fee_amount/); assert.match(source,/manual_required/); assert.doesNotMatch(source,/manualConfirmed/); assert.doesNotMatch(source,/manual_settlement_confirmed/)})
