// Goal-fit: rankings must follow the user's selected goals and conditions.
import assert from 'node:assert/strict';
import { recommendProjects, GOAL_OPTIONS } from '../src/engine/recommend.js';

const land = {
  areaSqM: 8000, provinceId: 'korat',
  provinceData: { ghi: 5.28 },
  coordinates: { lat: 14.98, lng: 102.1 },
  roadType: 'secondary', roadWidthMeters: 8,
  gridDistanceMeters: 200, landType: 'flat',
  hasWaterBody: false, hasAgriculturalWaste: false,
};

const rec = aims => recommendProjects(land, { aims, budget: 'unsure' });
const top1 = aims => rec(aims)[0].id;

// Every concrete goal: the #1 pick must match that goal (goalMatch flag on).
const EXPECTED_TOP1 = {
  save: 'small-solar',          // bill-cutting = small self-use solar, not a utility farm
  ev: 'ev-charging-hub',
  shop: null,                   // any storefront business, not energy projects
  rental: null,                 // any rentable space
  stay: 'homestay-camp',
  farm: null,                   // any farm-compatible project
  backup: null,                 // own power / storage
  income: null,
};
const SHOP = new Set(['roadside-cafe', 'minimart', 'laundry-shop', 'car-wash', 'ev-moto-swap']);
const RENTAL = new Set(['solar-lease', 'data-center-lease', 'solar-warehouse', 'self-storage', 'sports-court']);
const FARM = new Set(['agrivoltaics', 'carbon-forest', 'solar-dryer', 'solar-coldroom', 'biomass-biogas']);
const BACKUP = new Set(['grid-bess', 'small-solar', 'solar-utility-kit']);

for (const g of GOAL_OPTIONS.map(o => o.id)) {
  const res = rec([g]);
  const top = res[0];
  if (g === 'unsure') continue; // checked separately below
  assert.equal(top.goalMatch, true, `goal '${g}': #1 ${top.id} must be a goal match`);
  if (EXPECTED_TOP1[g]) assert.equal(top.id, EXPECTED_TOP1[g], `goal '${g}': #1 should be ${EXPECTED_TOP1[g]}, got ${top.id}`);
  if (g === 'shop') { assert.ok(SHOP.has(top.id), `shop goal: #1 must be a storefront, got ${top.id}`);
    assert.ok(res.slice(0, 3).every(r => r.goalMatch || SHOP.has(r.id)), 'shop: top-3 should be storefronts/matches'); }
  if (g === 'rental') assert.ok(RENTAL.has(top.id), `rental goal: #1 must be rentable space, got ${top.id}`);
  if (g === 'farm') assert.ok(FARM.has(top.id), `farm goal: #1 must be farm-compatible, got ${top.id}`);
  if (g === 'backup') assert.ok(BACKUP.has(top.id), `backup goal: #1 must be own-power/storage, got ${top.id}`);
  if (g === 'ev') { const ids = res.slice(0, 3).map(r => r.id);
    assert.ok(ids.includes('ev-charging-hub') && ids.includes('ev-moto-swap'), `ev: both EV projects should be top-3, got ${ids}`); }
  if (g === 'save') { const ids = res.slice(0, 3).map(r => r.id);
    assert.ok(ids.includes('small-solar'), `save: small-solar must be top-3, got ${ids}`); }
  // every matched option ranks above every non-matched one with the same status
  const unmatched = res.filter(r => !r.goalMatch && r.status === top.status);
  assert.ok(res.indexOf(top) < res.findIndex(r => r.id === unmatched[0]?.id) || !unmatched.length,
    `goal '${g}': a matched pick must outrank same-status non-matches`);
}

// 'unsure' = no preference: pure land ranking, nothing flagged as a match
const unsureRes = rec(['unsure']);
assert.ok(unsureRes.every(r => !r.goalMatch), "unsure must not flag goalMatch on anything");
const emptyRes = rec([]);
assert.deepEqual(unsureRes.map(r => r.id), emptyRes.map(r => r.id),
  "unsure alone must produce the same order as no goals");

// optional conditions actually change the score
const evHigh = rec(['ev']).find(r => r.id === 'ev-moto-swap').score;
const evLow = recommendProjects(land, { aims: ['ev'], evTraffic: 'low', budget: 'unsure' })
  .find(r => r.id === 'ev-moto-swap').score;
assert.ok(evHigh > evLow, `evTraffic high should outscore low (${evHigh} vs ${evLow})`);
const billHigh = recommendProjects(land, { aims: ['save'], monthlyBill: 45000, budget: 'unsure' })
  .find(r => r.id === 'small-solar').score;
const billLow = recommendProjects(land, { aims: ['save'], monthlyBill: 2000, budget: 'unsure' })
  .find(r => r.id === 'small-solar').score;
assert.ok(billHigh > billLow, `high bill should outscore low bill on small-solar (${billHigh} vs ${billLow})`);

// reasons surface the stated conditions
const withBill = recommendProjects(land, { aims: ['save'], monthlyBill: 45000, budget: 'unsure' })
  .find(r => r.id === 'small-solar');
assert.ok(withBill.reasons.some(x => x.includes('45,000')), 'small-solar reason should cite the stated bill');
const withTraffic = recommendProjects(land, { aims: ['ev'], evTraffic: 'high', budget: 'unsure' })
  .find(r => r.id === 'ev-charging-hub');
assert.ok(withTraffic.reasons.some(x => x.includes('traffic')), 'ev reason should cite flagged traffic');

console.log('GOAL-FIT: ALL CHECKS PASS');
