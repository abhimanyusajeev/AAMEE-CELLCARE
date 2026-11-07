export function PageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>{subtitle&&<p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{action}</div>}

