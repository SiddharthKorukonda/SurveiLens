import React from 'react'
export default function ClipViewer({src}:{src:string}){
  return (<video src={src} controls className="w-full rounded-xl border border-white/10 bg-black" />)
}
