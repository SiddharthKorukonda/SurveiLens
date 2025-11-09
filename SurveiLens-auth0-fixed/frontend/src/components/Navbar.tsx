import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
export default function Navbar(){
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0()
  const nav = useNavigate()
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur sticky top-0 z-50 border-b border-white/10">
      <div className="text-2xl font-bold text-mil-green">SurveiLens</div>
      <div className="flex gap-4 items-center text-sm">
        {isAuthenticated && (<>
          <Link to="/home" className="hover:text-mil-amber">User Home</Link>
          <Link to="/review" className="hover:text-mil-amber">Review</Link>
          <Link to="/audit" className="hover:text-mil-amber">Audit</Link>
          <Link to="/admin/policy" className="hover:text-mil-amber">Policy</Link>
          <Link to="/ask" className="hover:text-mil-amber">Ask</Link>
        </>)}
        {!isAuthenticated ? (
          <button onClick={()=>loginWithRedirect()} className="px-3 py-1.5 rounded-xl bg-mil-green text-black font-semibold">Login</button>
        ):(
          <button onClick={()=>{logout({ returnTo: window.location.origin }); nav('/')}} className="px-3 py-1.5 rounded-xl bg-white/10">Logout</button>
        )}
      </div>
    </div>
  )
}
