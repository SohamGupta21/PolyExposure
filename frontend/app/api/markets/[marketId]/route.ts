import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://data-api.polymarket.com'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId } = await params

  if (!marketId) {
    return NextResponse.json({ error: 'marketId is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`${BASE_URL}/markets/${marketId}`, {
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
        error: 'Failed to fetch market',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

