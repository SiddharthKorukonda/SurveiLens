import React from 'react'
export default function ReceiptPanel({tx}:{tx?:string}){ if(!tx) return null; return (<div className="p-3 rounded-xl border border-white/10 bg-black/30 text-sm">Solana receipt: <span className="font-mono">{tx}</span></div>) }
