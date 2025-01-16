'use client'

import { gql, useQuery } from '@apollo/client'
import { useTranslations } from 'next-intl'
import { Paper, List, ListItem, Typography, Chip } from '@mui/material'
import { LANGUAGES } from '@/config/languages'

const GET_USERS = gql`
  query GetUsers {
    users {
      userId
      name
      statuses
      languages
      timestamp
      locale
    }
  }
`

export default function UserList() {
  const { data, loading, error } = useQuery(GET_USERS, {
    pollInterval: 5000 // Poll every 5 seconds to keep the list updated
  })
  const t = useTranslations('Status')
  
  if (loading) return <Typography>Loading...</Typography>
  if (error) return <Typography color="error">Error loading users</Typography>

  return (
    <Paper className="mt-8 p-4">
      <Typography variant="h6" className="mb-4">Online Users</Typography>
      <List>
        {data?.users.map((user: any) => (
          <ListItem key={user.userId} className="flex flex-col items-start">
            <div className="flex flex-col w-full">
              <Typography variant="body1">{user.name}</Typography>
              <div className="mt-1">
                <div className="flex flex-wrap gap-1 mb-2">
                  {user.languages?.map((lang: string) => (
                    <Chip
                      key={lang}
                      label={LANGUAGES.find(l => l.code === lang)?.name || lang}
                      size="small"
                      variant="outlined"
                      className="mr-1"
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.statuses?.map((status: string) => (
                    <Chip
                      key={status}
                      label={t(status)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      className="mr-1"
                    />
                  ))}
                </div>
              </div>
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  )
} 