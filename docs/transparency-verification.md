# Dungeon track records

Local implementation, 10 November 2026. Andrew chose transparency while retaining the existing treasure-return rule.

At the gate, choose **Track records** in the Station selector. Edition records show settled attempts and participant-profile count; extraction rate and death/abandonment/timeout counts; active/unsettled and voided counts; mean/median loot extracted per recorded settled attempt; and mean/median elapsed run duration with coverage. The opening card points entrants to these records before payment. Four short pages occupy the existing inspector.

Outcomes come from the authoritative snapshot, not optimistic browser results. Failed nonvoid attempts contribute zero extracted loot. Positive loot requires a matching Applied settlement receipt and known item types; town equipment and consumed dungeon items are not extracted loot. Missing extraction history is excluded with coverage disclosed, not treated as zero. Timing is recorded durably on materialization and first terminal decision; expiry uses the deadline rather than a delayed cleanup time. Retry/restart preserve timestamps. Legacy runs have missing timing, not guessed timing. Idle time is included; settlement delay is excluded.

Statistics pool the edition's history across fee changes and refreshes, disclosed in the UI. They are descriptive, not a prediction of today's pool. Reference value is not cash proceeds or profit. Local profiles are not verified unique people; alternate accounts and collusion remain possible. Small samples and partial coverage may be misleading. This is transparency, not proof that maker incentives are solved.

Verification: 13 relevant server tests passed, including receipt mismatch, unknown settlement, loss-as-zero denominators, edition scoping, legacy timing, restart/retry, expiry timing and HTTP loop coverage. TypeScript and web build passed. Browser evidence in `evidence/transparency/browser.txt` records the gate's four pages at desktop/phone sizes. No economic rule/contract change, new purchase, funded run or state reset was performed for this feature. Existing local API restarted to load the changes.
