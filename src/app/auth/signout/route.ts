import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { getCurrentLocale } from '@/utils'

export function GET(request: NextRequest) {
  // Get the preferred locale
  const locale = getCurrentLocale(request)
  
  // Get any search parameters to preserve them in the redirect
  const searchParams = request.nextUrl.searchParams.toString()
  const queryString = searchParams ? `?${searchParams}` : ''

  // Redirect to the localized sign-out page
  return redirect(`/${locale}/auth/signout${queryString}`)
} 