// Types for Polymarket API responses
export interface PolymarketActivity {
  id: string
  type: string
  user: string
  market: string
  outcome: string
  amount: string
  price: string
  timestamp: string
  transactionHash?: string
  [key: string]: any
}

export interface PolymarketPosition {
  id: string
  user: string
  market: string
  outcome: string
  shares: string
  avgPrice: string
  currentPrice?: string
  [key: string]: any
}

export interface PolymarketMarket {
  id: string
  question: string
  slug: string
  description?: string
  endDate?: string
  resolutionSource?: string
  [key: string]: any
}

// Types for UI components
export interface Position {
  market: string
  position: string
  shares: number
  avgPrice: number
  currentPrice: number
  value: number
  pnl: number
  sector: string
  expiresAt: string
  marketId?: string
}

export interface ActivityLogItem {
  id: string | number
  action: 'BUY' | 'SELL'
  market: string
  shares: number
  price: number
  time: string
  timestamp?: string
}

export interface ExpirationTimelineItem {
  date: string
  market: string
  value: number
  daysFromNow: number
}

