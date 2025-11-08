import React from 'react'
import { useAuth0 } from '@auth0/auth0-react'
export default function Home(){
  const { loginWithRedirect } = useAuth0()
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <div className="text-6xl font-extrabold tracking-tight text-mil-green">SurveiLens</div>
      <div className="text-lg opacity-80 mt-4">Military-grade situational awareness, human-in-the-loop, privacy-first</div>
      <button onClick={()=>loginWithRedirect()} className="mt-8 px-5 py-3 rounded-2xl bg-mil-green text-black font-bold">Login</button>
    </div>
  )
}
