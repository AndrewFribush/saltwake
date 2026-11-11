/** Rules v9 authoring budgets. Legacy editions keep their pinned limits. */
export const maxAuthoredFloors=16;
export const maxAuthoredEncounters=64;
export function authoringBudgetErrors(floors:readonly {sockets:readonly unknown[]}[]):string[]{
 const errors:string[]=[];
 if(floors.length<1||floors.length>maxAuthoredFloors)errors.push(`Use 1–${maxAuthoredFloors} floors.`);
 if(floors.reduce((n,f)=>n+f.sockets.length,0)>maxAuthoredEncounters)errors.push(`Use at most ${maxAuthoredEncounters} encounters across all floors.`);
 return errors;
}
