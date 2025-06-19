'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSnackbar } from '@/contexts/SnackContext'
import { useTranslations } from 'next-intl'
import { useGroups } from '@/store/GroupsProvider'
import { Group } from '@/generated/graphql'

export function JoinGroupHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { showSnackbar } = useSnackbar()
  const { groups } = useGroups()
  const t = useTranslations()
  const [hasShownToast, setHasShownToast] = useState(false)

  useEffect(() => {
    const joinedGroupId = searchParams.get('joinedGroup')
    
    if (joinedGroupId && !hasShownToast && groups) {
      // Wait a bit for groups to load, then show the toast
      const timer = setTimeout(() => {
        // Find the group by ID
        const joinedGroup = groups.find((g: Group) => g._id === joinedGroupId)
        const groupName = joinedGroup?.name || 'the group'
        
        showSnackbar(t('youveJoined', { groupName }), 'success')
        setHasShownToast(true)
        
        // Clean up URL by removing the parameter
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete('joinedGroup')
        const newUrl = newSearchParams.toString()
        router.replace(newUrl ? `/?${newUrl}` : '/', { scroll: false })
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [searchParams, router, showSnackbar, t, hasShownToast, groups])

  return null
} 