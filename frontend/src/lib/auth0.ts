import { useAuth0 } from '@auth0/auth0-react'
export function useApiHeaders(){
  const { getAccessTokenSilently } = useAuth0()
  async function headers(){
    const token = await getAccessTokenSilently().catch(()=>null)
    const h: Record<string,string> = { 'Content-Type':'application/json' }
    if(token) h['Authorization'] = `Bearer ${token}`
    return h
  }
  return { headers }
}
