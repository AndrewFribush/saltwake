export type ItemType='club'|'sword'|'armor'|'herb'|'iron'|'flask'|'tonic'|'fineTonic';
export type ItemLocation =
 | {kind:'owned';profile:string}|{kind:'listed';listing:string}
 | {kind:'edition_fixed';edition:string;item_type:ItemType}|{kind:'edition_random';edition:string;table_id:string}
 | {kind:'reserved';run:string;socket:string;source_pool:string}|{kind:'loadout';run:string;profile:string}
 | {kind:'crafting';batch:string;source_owner:string}|{kind:'bank'}|{kind:'consumed';operation:string};
export type Item={id:string;item_type:ItemType;location:ItemLocation};
export type Socket={readonly id:string;readonly room:number;readonly slot:number;readonly enemy:'none'|'pursuer'|'charger';readonly trap:boolean;readonly reward:ItemType|null};
export type EditionTerms={readonly title:string;readonly rules_version:number;readonly modules:readonly string[];readonly sockets:readonly Socket[];readonly opens_at_ms:string;readonly closes_at_ms:string;readonly no_reward:boolean;readonly difficulty_tag:string;readonly style_tag:string;readonly run_duration_ms:string;readonly max_runs:number};
export type Command={readonly actor:string;readonly action:
 |{readonly type:'debit';readonly amount:string}
 |{readonly type:'publish';readonly terms:EditionTerms;readonly fee:string;readonly funding:readonly string[]}
 |{readonly type:'admit';readonly edition_id:string;readonly expected_version:string;readonly expected_fee:string;readonly loadout_ids:readonly string[];readonly seed:string}
 |{readonly type:'settle';readonly run_id:string;readonly outcome:'extracted'|'died'|'abandoned'|'expired';readonly disposition:Partition;readonly carried_dungeon_ids:readonly string[]}
 |{readonly type:'void';readonly run_id:string;readonly reason:string;readonly disposition:Partition}
 |{readonly type:'finalize_close';readonly edition_id:string}};
export type OperationStatus={status:'Applied'|'Rejected';op_id:string;payload_hash:string;result:string;run:EconomicRun|null}|{status:'Pending';op_id:string;tx_hash?:string}|{status:'Unknown';op_id:string;reason:string};

export type Partition={readonly town_consumed:readonly string[];readonly town_returned:readonly string[];readonly town_forfeited:readonly string[];readonly dungeon_consumed:readonly string[];readonly dungeon_extracted:readonly string[];readonly dungeon_returned:readonly string[]};
export type Assignment={socket:string;item_id:string;source_pool:string};
export type EconomicRun={id:string;edition:string;player:string;fee:string;deadline_ms:string;seed:string;loadout_ids:string[];assignments:Assignment[];status:'active'|'extracted'|'died'|'abandoned'|'expired'|'void';terminal_reason:string|null};
export type EconomicEdition={id:string;maker:string;terms:EditionTerms;terms_hash:string;fee:string;version:string;placement_paid:string;original_value:string;active_runs:string[];funded_ids:string[];closed:boolean};
export type EconomySnapshot={credits:Record<string,string>;bank:string;items:Item[];editions:EconomicEdition[];runs:EconomicRun[]};
