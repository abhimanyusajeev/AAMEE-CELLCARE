"use client";
const CODE39: Record<string,string> = {
"0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn",
A:"wnnnnwnnw",B:"nnwnnwnnw",C:"wnwnnwnnn",D:"nnnnwwnnw",E:"wnnnwwnnn",F:"nnwnwwnnn",G:"nnnnnwwnw",H:"wnnnnwwnn",I:"nnwnnwwnn",J:"nnnnwwwnn",K:"wnnnnnnww",L:"nnwnnnnww",M:"wnwnnnnwn",N:"nnnnwnnww",O:"wnnnwnnwn",P:"nnwnwnnwn",Q:"nnnnnnwww",R:"wnnnnnwwn",S:"nnwnnnwwn",T:"nnnnwnwwn",U:"wwnnnnnnw",V:"nwwnnnnnw",W:"wwwnnnnnn",X:"nwnnwnnnw",Y:"wwnnwnnnn",Z:"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn","/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
};
export function BarcodeGraphic({value}:{value:string}) {
 const text=(value||"").toUpperCase().replace(/[^0-9A-Z. $/+%*-]/g,"");
 const seq=`*${text}*`; let x=0; const bars:string[]=[];
 for(const ch of seq){const p=CODE39[ch]||CODE39["-"];for(let i=0;i<p.length;i++){const w=p[i]==="w"?3:1;if(i%2===0)bars.push(`<rect x="${x}" y="0" width="${w}" height="32"/>`);x+=w;}x+=1;}
 return <svg aria-label={`Code 39 barcode ${text}`} role="img" viewBox={`0 0 ${x} 32`} style={{width:"100%",height:"9mm"}}><g fill="#000" dangerouslySetInnerHTML={{__html:bars.join("")}}/></svg>;
}
export default function Barcode({value, productName="Product"}:{value:string|null|undefined;productName?:string}) {
 const code=(value||"").trim();
 function printSticker(){
  if(!code)return;
  const safeName=productName.replace(/[<>&"]/g,"");
  const safeCode=code.replace(/[^0-9A-Za-z._/-]/g,"");
  const svg=document.querySelector(`[data-barcode="${CSS.escape(code)}"] svg`)?.outerHTML||"";
  const w=window.open("","_blank","width=420,height=300");
  if(!w)return;
  w.document.write(`<!doctype html><html><head><title>Barcode Sticker</title><style>@page{size:50mm 25mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.sticker{width:50mm;height:25mm;padding:2mm 2mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}.name{font-size:8pt;font-weight:700;text-align:center;max-width:46mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1mm}.code{font:6pt monospace;letter-spacing:1px;margin-top:1mm}</style></head><body><main class="sticker"><div class="name">${safeName}</div>${svg}<div class="code">${safeCode}</div></main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
  w.document.close();
 }
 return <div className="inline-flex flex-col items-center gap-1" data-barcode={code}><div className="w-28"><BarcodeGraphic value={code}/></div><span className="font-mono text-[10px] tracking-widest">{code}</span><button type="button" onClick={printSticker} className="rounded border px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Download sticker</button></div>;
}
