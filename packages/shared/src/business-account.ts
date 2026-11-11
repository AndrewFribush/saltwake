/** Confirmed cash movements; never an estimate of profit or inventory value. */
export type CashEntry={id:string;category:'trade'|'bank'|'npc'|'entry'|'maker'|'placement';direction:'in'|'out';amount:string;detail:string;pending?:boolean};
export type BusinessAccount={entries:CashEntry[];recordedIn:string;recordedOut:string;recordedNet:string;pendingIncome:string;limitations:string[]};
