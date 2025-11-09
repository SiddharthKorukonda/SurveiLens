import React from 'react'
import { Auth0Provider } from '@auth0/auth0-react'
import RoutesView from './routes'
import Navbar from './components/Navbar'
const domain = (import.meta as any).env.VITE_AUTH0_DOMAIN || (window as any).AUTH0_DOMAIN
const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID || (window as any).AUTH0_SPA_CLIENT_ID
const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE || (window as any).AUTH0_AUDIENCE
const redirectUri = window.location.origin + '/home'
export default function App(){
  return (<Auth0Provider domain={domain} clientId={clientId} authorizationParams={{redirect_uri: redirectUri, audience}}><div className="min-h-screen"><Navbar/><RoutesView/></div></Auth0Provider>)
}
