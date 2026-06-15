import { NextRequest, NextResponse } from 'next/server'
import { ConfidentialClientApplication } from '@azure/msal-node'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?error=no_code', req.url))
  }

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    },
  })

  try {
    const result = await cca.acquireTokenByCode({
      code,
      scopes: ['https://ml.azure.com/user_impersonation', 'offline_access'],
      redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/microsoft/callback`,
    })

    const cookieStore = cookies()
    cookieStore.set('azure_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600,
      path: '/',
    })

    return NextResponse.redirect(new URL('/dashboard', req.url))
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=auth_failed', req.url))
  }
}
