export type ItemType='club'|'sword'|'armor'|'herb'|'iron'|'flask'|'tonic'|'fineTonic';
export type ItemLocation =
 | {kind:'owned';profile:string}|{kind:'listed';listing:string}
 | {kind:'edition_fixed';edition:string;item_type:ItemType}|{kind:'edition_random';edition:string;table_id:string}
 | {kind:'reserved';run:string;socket:string;source_pool:string}|{kind:'loadout';run:string;profile:string}
 | {kind:'crafting';batch:string;source_owner:string}|{kind:'bank'}|{kind:'consumed';operation:string};
export type Item={id:string;item_type:ItemType;location:ItemLocation};
export type Socket={readonly id:string;readonly room:number;readonly slot:number;readonly enemy:'none'|'pursuer'|'charger'|'archer'|'bomber'|'brute'|'nest';readonly trap:boolean;readonly reward:ItemType|null};
export type EditionTerms={readonly title:string;readonly rules_version:number;readonly modules:readonly string[];readonly sockets:readonly Socket[];readonly opens_at_ms:string;readonly closes_at_ms:string;readonly no_reward:boolean;readonly difficulty_tag:string;readonly style_tag:string;readonly run_duration_ms:string;readonly max_runs:number};
export type RandomTable={readonly table_id:string;readonly socket_ids:readonly string[];readonly item_ids:readonly string[]};
export type RandomFunding={readonly table_id:string;readonly item_ids:readonly string[]};
export type Command={readonly actor:string;readonly action:
 |{readonly type:'create_shop';readonly title:string;readonly district:string;readonly x:number;readonly y:number;readonly interior:string;readonly open:boolean}
 |{readonly type:'update_shop';readonly shop_id:string;readonly expected_version:string;readonly title:string;readonly district:string;readonly x:number;readonly y:number;readonly interior:string;readonly open:boolean}
 |{readonly type:'stock_shop';readonly shop_id:string;readonly item_ids:readonly string[];readonly unit_price:string}
 |{readonly type:'remove_shop';readonly shop_id:string;readonly expected_version:string}
 |{readonly type:'list_for';readonly item_ids:readonly string[];readonly unit_price:string;readonly buyer:string}
 |{readonly type:'debit';readonly amount:string}
 |{readonly type:'publish';readonly terms:EditionTerms;readonly fee:string;readonly funding:readonly string[]}
 |{readonly type:'admit';readonly edition_id:string;readonly expected_version:string;readonly expected_fee:string;readonly loadout_ids:readonly string[];readonly seed:string}
 |{readonly type:'settle';readonly run_id:string;readonly outcome:'extracted'|'died'|'abandoned'|'expired';readonly disposition:Partition;readonly carried_dungeon_ids:readonly string[]}
 |{readonly type:'void';readonly run_id:string;readonly reason:string;readonly disposition:Partition}
 |{readonly type:'publish_random';readonly terms:EditionTerms;readonly fee:string;readonly fixed_funding:readonly string[];readonly random_tables:readonly RandomTable[]}
 |{readonly type:'refresh';readonly edition_id:string;readonly fixed_funding:readonly string[];readonly random_funding:readonly RandomFunding[]}
 |{readonly type:'set_fee';readonly edition_id:string;readonly new_fee:string}
 |{readonly type:'list';readonly item_ids:readonly string[];readonly unit_price:string}
 |{readonly type:'cancel_listing';readonly listing_id:string}
 |{readonly type:'buy';readonly listing_id:string;readonly item_ids:readonly string[];readonly expected_unit_price:string}
 |{readonly type:'bank_buy';readonly item_ids:readonly string[];readonly expected_unit_prices:readonly string[]}
 |{readonly type:'bank_sell';readonly item_ids:readonly string[];readonly expected_unit_prices:readonly string[]}
 |{readonly type:'fill_npc_order';readonly order_id:string;readonly item_ids:readonly string[];readonly expected_unit_price:string}
 |{readonly type:'begin_craft';readonly batch_id:string;readonly input_ids:readonly string[];readonly challenge_commitment:string;readonly deadline_ms:string}
 |{readonly type:'finish_craft';readonly batch_id:string;readonly tier:CraftTier;readonly reason:FinishReason}
 |{readonly type:'begin_recovery';readonly batch_id:string;readonly bank_input_ids:readonly string[];readonly challenge_commitment:string;readonly deadline_ms:string}
 |{readonly type:'finish_recovery';readonly batch_id:string;readonly tier:CraftTier;readonly reason:FinishReason}
 |{readonly type:'finalize_close';readonly edition_id:string}};
export type OperationStatus={status:'Applied'|'Rejected';op_id:string;payload_hash:string;result:string;run:EconomicRun|null}|{status:'Pending';op_id:string;tx_hash?:string}|{status:'Unknown';op_id:string;reason:string};

export type Partition={readonly town_consumed:readonly string[];readonly town_returned:readonly string[];readonly town_forfeited:readonly string[];readonly dungeon_consumed:readonly string[];readonly dungeon_extracted:readonly string[];readonly dungeon_returned:readonly string[]};
export type Assignment={socket:string;item_id:string;source_pool:string};
export type EconomicRun={id:string;edition:string;player:string;fee:string;deadline_ms:string;seed:string;loadout_ids:string[];assignments:Assignment[];status:'active'|'extracted'|'died'|'abandoned'|'expired'|'void';terminal_reason:string|null};
export type EconomicEdition={id:string;maker:string;terms:EditionTerms;terms_hash:string;fee:string;version:string;placement_paid:string;original_value:string;refresh_value:string;refresh_ids:string[];random_tables:RandomTable[];active_runs:string[];funded_ids:string[];closed:boolean;extracted_value:string;consumed_value:string;banked_value:string};
export type Listing={id:string;seller:string;item_ids:string[];remaining_ids:string[];unit_price:string;status:'active'|'sold'|'cancelled'};
export type NpcOrder={id:string;item_type:ItemType;unit_price:string;remaining:number;budget:string;seeded_demo_demand:boolean};
export type BankPrice={item_type:ItemType;sale_price:string;buyback_price:string};
export type Shopfront={id:string;owner:string;title:string;district:string;x:number;y:number;interior:string;version:string;open:boolean;listing_ids:string[]};
export type EconomySnapshot={buy_ins?:Record<string,string>;reservations?:Record<string,string>;shops?:Shopfront[];credits:Record<string,string>;bank:string;items:Item[];editions:EconomicEdition[];runs:EconomicRun[];listings:Listing[];npc_order:NpcOrder;bank_prices:BankPrice[];batches:CraftBatch[];recovery:RecoveryState;coin_issuance?:{coins_issued:string;near_received:string;purchases:string}};

export type CraftTier='normal'|'fine';
export type FinishReason='completed'|'expired';
export type CraftBatch={id:string;actor:string;input_ids:string[];challenge_commitment:string;deadline_ms:string;recovery:boolean;wage_reserved:string;status:'active'|'finished';tier:CraftTier|null;reason:FinishReason|null;output_ids:string[]};
export type RecoveryState={epoch:string;budget:string;wage:string;max_jobs_per_profile:number;jobs:Record<string,number>};
