# Bounded economy stress evidence

Four actual-WASM scenarios exercise the same finite seeded population without new users, external money or injected balances. The test audits each mutation and rejection against exact item identity, recorded recipe outputs, active reservations, edition funding value and total coins including fee escrow, recovery funds, NPC order funds and reserved wages.

## Observed scenarios

| Scenario | Verified result |
| --- | --- |
| Absent demand | Maker pays32 for all16 NPC material instances and3 placement credits. Four batches produce8 outputs;6 remain unsold,2 residual funded outputs go to the bank on closure. Zero admissions. Time does not produce customers, refill materials or refund the maker. Cancellation returns unsold goods without revenue. |
| Support exhaustion | Recovery transfers6 wage credits; the seeded NPC order transfers20. Both stop when exhausted. Expired recovery pays only once and produces normal quality. Bank buybacks fail without enough bank credits; time resets none of these budgets. |
| Low extraction | Five paid losses drain one customer's10 credits. Two operator incident voids refund only fee escrow and do not recreate consumed treasure. Depletion blocks admission; closure transfers residual treasure to the bank. |
| Concentrated extraction/coordinated trade | Six admissions and a6-credit maker buyback recycle the same six goods. No new coins or instances appear. The maker remains down4 placement credits. Self-entry and duplicate replenishment reject. |

These tests explicitly distinguish conservation of currency from crafting new goods. Recipe inputs become recorded consumed instances; recipe outputs are the only added item instances. Banked goods are transfers, not burns. Coordinated trades demonstrate accounting conservation, not resistance to every possible exploit or proof of organic demand.

## Verification status

Source: tests/contract/economy-stress.test.ts.
Evidence: docs/evidence/economy-stress/contract-tests.txt.

The initial four-case run passed three cases; the absent-demand case hit a sandbox fast-forward RPC timeout. The test now advances in bounded100-block requests. Its focused retry passed in44seconds. Thus all four cases have passing evidence, but this is not a clean all-at-once four-case sweep. Initial failure output is retained. Typecheck passes.

Only disposable local sandboxes were used. No production, testnet or existing persistent world was changed by these scenarios.

## Product implications and remaining scope

A low-population market can stall: goods remain unsold, maker funds remain committed, and finite support eventually stops. Passing conservation tests does not resolve that design problem or establish a sustainable economy. The interface must keep these states legible; future ecosystem/human trials must test whether people find useful, enjoyable decisions after the initial subsidies end. Long-term NPC replenishment policy, population behavior, public identity and broader scale/record capacities remain open. S17 has concrete stress evidence now; the full S16/S17 and final acceptance gates are not declared complete.
