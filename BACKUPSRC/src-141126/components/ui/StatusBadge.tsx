const map:Record<string,string>={AVAILABLE:"bg-emerald-50 text-emerald-700",LOW_STOCK:"bg-amber-50 text-amber-700",OUT_OF_STOCK:"bg-red-50 text-red-700",READY_FOR_PICKUP:"bg-emerald-50 text-emerald-700",REPAIRING:"bg-amber-50 text-amber-700",RECEIVED:"bg-blue-50 text-blue-700",DELIVERED:"bg-slate-100 text-slate-700"};
export function StatusBadge({value}:{value:string}){return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${map[value]??"bg-slate-100 text-slate-700"}`}>{value.replaceAll("_"," ")}</span>}

