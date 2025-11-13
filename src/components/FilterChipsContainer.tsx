import React from 'react'

interface FilterChipsContainerProps {
  children: React.ReactNode
}

export default function FilterChipsContainer({ children }: FilterChipsContainerProps) {
  return (
    <div className="flex flex-wrap gap-1 px-4 pb-2" style={{ gap: '0.2rem' }}>
      {children}
    </div>
  )
}
