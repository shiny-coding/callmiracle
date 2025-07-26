'use client'
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import Cookies from 'js-cookie'

interface ServerContextType {
  serverId: string | null
  preferredServerId: string | null
  setPreferredServerId: (serverId: string | null) => void
  availableServers: string[]
}

const ServerContext = createContext<ServerContextType | null>(null)

export function ServerProvider({ children }: { children: ReactNode }) {
  // Get current server ID from environment (set by server)
  const [serverId, setServerId] = useState<string | null>(null)
  const [preferredServerId, setPreferredServerIdState] = useState<string | null>(null)
  
  // Available servers (could be made configurable)
  const availableServers = ['auto', '1', '2', '3']

  useEffect(() => {
    // Get server ID from meta tag set by server
    const serverIdMeta = document.querySelector('meta[name="server-id"]')
    if (serverIdMeta) {
      setServerId(serverIdMeta.getAttribute('content'))
    }

    // Get preferred server from cookie
    const preferred = Cookies.get('preferred_server')
    if (preferred && preferred !== 'auto') {
      setPreferredServerIdState(preferred)
    }
  }, [])

  const setPreferredServerId = async (newServerId: string | null) => {
    setPreferredServerIdState(newServerId)
    
    if (newServerId === null || newServerId === 'auto') {
      Cookies.remove('preferred_server')
    } else {
      Cookies.set('preferred_server', newServerId, { expires: 30 }) // 30 days
    }

    // Call API to inform server about preference
    try {
      await fetch('/api/select-server', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          preferredServerId: newServerId === 'auto' ? null : newServerId 
        }),
      })
    } catch (error) {
      console.error('Failed to set server preference:', error)
    }

    // Reload page to connect to preferred server
    if (newServerId !== null && newServerId !== 'auto') {
      window.location.reload()
    }
  }

  return (
    <ServerContext.Provider value={{
      serverId,
      preferredServerId,
      setPreferredServerId,
      availableServers
    }}>
      {children}
    </ServerContext.Provider>
  )
}

export function useServer() {
  const context = useContext(ServerContext)
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider')
  }
  return context
}