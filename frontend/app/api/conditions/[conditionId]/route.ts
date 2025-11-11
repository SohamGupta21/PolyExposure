import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conditionId: string }> }
) {
  const { conditionId } = await params

  if (!conditionId) {
    return NextResponse.json({ error: 'conditionId is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/conditions/${conditionId}`, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { error: errorData.error || errorData.detail || `API error: ${response.status}`, details: errorData.details },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch condition from backend',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

