import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://data-api.polymarket.com'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = searchParams.get('limit') || '100'
  const offset = searchParams.get('offset') || '0'
  const active = searchParams.get('active')

  try {
    let url = `${BASE_URL}/markets?limit=${limit}&offset=${offset}`
    if (active !== null && active !== undefined) {
      url += `&active=${active}`
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PolyPortfolio/1.0',
      },
    })

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
        error: 'Failed to fetch markets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

