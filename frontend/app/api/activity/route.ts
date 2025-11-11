import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://data-api.polymarket.com'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const user = searchParams.get('user')
  const limit = searchParams.get('limit') || '500'
  const offset = searchParams.get('offset') || '0'

  if (!user) {
    return NextResponse.json({ error: 'user parameter is required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `${BASE_URL}/activity?user=${user}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PolyExposure/1.0',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `API error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch activity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

