import React from 'react'
import { Link } from 'react-router-dom'
export default function UserHome(){
  const servers:any[] = []
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-bold">Your Servers</div>
        <Link to="/servers/new" className="px-3 py-1.5 rounded-xl bg-white/10">Create Server</Link>
      </div>
      {servers.length===0 ? (<div className="mt-8 opacity-70">No servers yet. Click Create Server to add up to 4 cameras.</div>):(<div/>)}
    </div>
  )
}
