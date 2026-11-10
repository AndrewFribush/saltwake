Nothing was run. All findings come from reading the pasted source and tracing cases by hand.

**I found no important correctness bugs against the rules you listed.** I traced each rule through the code.

- **Charge lane:** the lane is fixed when the threat is shown and used as-is on the next turn. Sidestepping makes the boar run to the wall. Stepping into or along the lane gets the player hit. The charge stops at the first creature, and recovery lasts exactly one turn.
- **Hazards on enemies:** charge strikes and armed spikes both damage enemies, and dead enemies are skipped. I found no case where the player takes damage on a tile that wasn't marked as danger.
- **Bag limits:** pickup refuses a seventh bag item. Equipping into an empty armor slot works with a full bag. Equipping from the bag frees a slot, so the displaced item fits.
- **Displaced items:** displaced town gear goes to the bag, or the equip is rejected if there is no room. Displaced dungeon gear goes to the bag if there's room, otherwise to the floor. Town items cannot be dropped.
- **Floor consumables:** they can only be used while standing on them, and only once, because they are then marked consumed.
- **Origins:** no action changes an item's origin. The end-of-run check confirms each item's origin matches the list it was registered in.
- **End-of-run outcomes:** each one matches your rules.
  - Death sends unconsumed town items to the bank and unconsumed dungeon items back to the pool. Consumed items stay spent.
  - Extraction awards only dungeon items in the bag or equipment slots. Floor and unvisited loot go back.
  - Void returns everything unconsumed.
- **Partition:** duplicate IDs, missing items, wrong origins and unlisted items all make the end-of-run check throw. Every ID lands in exactly one group.

**Lower priority: three inputs that are accepted when they should be rejected.** The game never produces these today, but future content or code could.

1. **Adding items skips the inventory rules.** For example, `const s=createRun(); addItem(s,{id:'x',type:'sword',origin:'town',location:{kind:'weapon'}})` leaves two items in the weapon slot while the player is still recorded as holding the club. The same gap allows a town item on the floor, more than six bag items, or an item in the wrong slot. Nothing stops items being added after the run starts, either. The mistake only surfaces when the end-of-run check throws, and the practice screen runs that check while drawing, so the whole screen crashes. Fix: check location rules when adding items, and lock both ID lists once the run starts.
2. **A malformed inventory action still uses up a turn.** For example, `act(createRun(), {type:'pickup'} as any)` has no item ID, skips the inventory step, increases the turn count, and lets enemies act. Fix: reject any action whose type isn't recognized, and any inventory action without an item ID.
3. **No error boundary around the end-of-run report.** If that check throws, the whole screen goes blank instead of showing an error. This only matters once item 1 lets bad state in.