/** Land rules for player-built town spaces (land-v1). The contract (`contracts/economy/src/shops.rs`) is authoritative
 * and exposes the same values through its `land_rules` view; this mirror only drives UI hints before submission. */
export const landRules={
 version:'land-v1',
 maxBuildings:32,
 maxPlotsPerOwner:3,
 footprint:{width:3,height:2},
 interior:{width:11,height:9,maxFixtures:24,maxFixtureText:160},
 kinds:['shop','dungeon'] as const,
} as const;
export const plotsOwned=(shops:readonly {owner:string}[],profile:string)=>shops.filter(s=>s.owner===profile).length;
