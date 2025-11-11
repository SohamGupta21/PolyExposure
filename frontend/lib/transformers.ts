import type { PolymarketActivity, PolymarketPosition, PolymarketMarket, Position, ActivityLogItem, ExpirationTimelineItem } from './types'

// Helper to format time ago
function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now.getTime() - time.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  } else {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }
}

// Helper to calculate days from now
function daysFromNow(dateString: string): number {
  // Parse date as local date (YYYY-MM-DD format) to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const now = new Date()
  
  // Set both to midnight local time for accurate day calculation
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  
  const diffMs = targetMidnight.getTime() - nowMidnight.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

// Helper to get sector from market question (simple categorization)
function getSector(question: string): string {
  const lower = question.toLowerCase()
  if (lower.includes('president') || lower.includes('election') || lower.includes('political')) {
    return 'Politics'
  }
  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('ethereum') || lower.includes('btc') || lower.includes('eth')) {
    return 'Crypto'
  }
  if (lower.includes('ai') || lower.includes('technology') || lower.includes('tech')) {
    return 'Technology'
  }
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('economic') || lower.includes('inflation')) {
    return 'Economics'
  }
  if (lower.includes('sport') || lower.includes('nfl') || lower.includes('nba') || lower.includes('soccer')) {
    return 'Sports'
  }
  return 'Other'
}

// Transform Polymarket positions to UI format
export function transformPositions(
  positionsData: PolymarketPosition[],
  marketsMap?: Map<string, PolymarketMarket>
): Position[] {
  if (!Array.isArray(positionsData) || positionsData.length === 0) {
    console.warn("transformPositions: No positions data provided or empty array")
    return []
  }

  console.log("transformPositions: Processing", positionsData.length, "positions")
  console.log("transformPositions: Sample position:", positionsData[0])
  console.log("transformPositions: Markets map size:", marketsMap?.size || 0)

  const transformed = positionsData
    .map((pos, index) => {
      // Try multiple possible field names - market might be an object or ID
      const conditionId = pos.conditionId || pos.condition?.id || pos.market || pos.marketId || ''
      const marketId = pos.market?.id || pos.market?.slug || pos.marketId || conditionId
      
      // Get market info from map or from the position itself
      let market = marketsMap?.get(conditionId) || marketsMap?.get(marketId)
      if (!market && pos.market && typeof pos.market === 'object') {
        market = pos.market
      }
      if (!market && pos.condition?.market) {
        market = pos.condition.market
      }
      if (!market && conditionId) {
        market = marketsMap?.get(pos.condition?.id || '')
      }
      
      // Get market question - Polymarket API uses 'title' field directly on position
      const marketQuestion = 
        pos.title ||
        market?.question || 
        market?.title || 
        market?.name ||
        market?.marketMaker ||
        pos.market?.question || 
        pos.market?.title ||
        pos.condition?.question ||
        pos.condition?.market?.question ||
        pos.marketTitle || 
        (conditionId && conditionId.length > 10 ? `Market ${conditionId.slice(0, 8)}...` : 'Unknown Market')
      
      // Get shares - try multiple field names, handle both string and number
      // Polymarket API uses 'size' for position size
      const sharesValue = pos.size || pos.shares || pos.quantity || pos.amount || pos.tokens || pos.sharesNum || '0'
      const shares = typeof sharesValue === 'string' ? parseFloat(sharesValue) : (sharesValue || 0)
      
      // Get prices - try multiple field names, handle both string and number
      const avgPriceValue = pos.avgPrice || pos.averagePrice || pos.costBasis || pos.price || pos.avgPriceNum || '0'
      const avgPrice = typeof avgPriceValue === 'string' ? parseFloat(avgPriceValue) : (avgPriceValue || 0)
      
      // Polymarket API uses 'curPrice' for current price, 'currentValue' for total value
      const currentPriceValue = pos.curPrice || pos.currentPrice || pos.price || pos.latestPrice || pos.marketPrice || pos.currentPriceNum || avgPrice || '0'
      const currentPrice = typeof currentPriceValue === 'string' ? parseFloat(currentPriceValue) : (currentPriceValue || 0)
      
      // Use currentValue if available, otherwise calculate from shares * currentPrice
      const value = pos.currentValue !== undefined && pos.currentValue !== null 
        ? (typeof pos.currentValue === 'string' ? parseFloat(pos.currentValue) : pos.currentValue)
        : (shares * currentPrice)
      
      // Use cashPnl if available, otherwise calculate
      const pnl = pos.cashPnl !== undefined && pos.cashPnl !== null
        ? (typeof pos.cashPnl === 'string' ? parseFloat(pos.cashPnl) : pos.cashPnl)
        : ((currentPrice - avgPrice) * shares)

      // Get outcome/position - Polymarket API uses 'outcome' field
      const outcome = pos.outcome || pos.side || pos.position || 'Yes'
      
      // Get end date - Polymarket API uses 'endDate' field directly on position
      const endDate = 
        pos.endDate ||
        market?.endDate || 
        market?.end_date_iso || 
        market?.endDateISO ||
        pos.expiresAt ||
        ''

      const transformedPos = {
        market: marketQuestion,
        position: outcome,
        shares: Math.round(shares * 100) / 100, // Keep decimal precision for small amounts
        avgPrice,
        currentPrice,
        value: Math.round(value * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        sector: getSector(marketQuestion),
        expiresAt: endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        marketId: marketId,
      }

      if (index < 3) {
        console.log(`transformPositions: Position ${index}:`, {
          conditionId,
          shares,
          avgPrice,
          currentPrice,
          value,
          pnl,
          outcome,
          marketQuestion
        })
      }

      return transformedPos
    })
    .filter((pos) => {
      // Only filter out positions with truly zero shares (allow very small amounts)
      // Show positions even if currentValue is 0, as long as they have shares/size
      const hasShares = pos.shares > 0.0001
      if (!hasShares) {
        console.log("transformPositions: Filtering out position with zero shares:", pos.market)
      }
      return hasShares
    })

  console.log("transformPositions: Transformed", transformed.length, "positions after filtering")
  return transformed
}

// Transform Polymarket activity to UI format
export function transformActivity(
  activityData: PolymarketActivity[],
  marketsMap?: Map<string, PolymarketMarket>
): ActivityLogItem[] {
  if (!Array.isArray(activityData) || activityData.length === 0) {
    return []
  }

  return activityData
    .slice(0, 50) // Limit to recent 50 activities
    .map((activity, index) => {
      // Get market title - API returns 'title' DIRECTLY on activity object (highest priority)
      const marketQuestion = 
        (activity as any).title ||  // PRIMARY: title is directly on activity object
        (activity as any).marketTitle ||
        activity.market?.question || 
        activity.market?.title ||
        (activity as any).condition?.question ||
        (activity as any).condition?.market?.question ||
        ((activity as any).conditionId && (activity as any).conditionId.length > 10 
          ? `Market ${(activity as any).conditionId.slice(0, 8)}...` 
          : 'Unknown Market')
      
      // Determine action type - API uses 'side' field ("BUY" or "SELL")
      const side = ((activity as any).side || activity.type || (activity as any).action || 'BUY').toUpperCase()
      const action = side === 'SELL' ? 'SELL' : 'BUY'
      
      // Get shares - API uses 'size' field (number, not string)
      const sharesValue = 
        (activity as any).size ||  // PRIMARY: size is the number of shares
        activity.amount || 
        (activity as any).shares || 
        (activity as any).quantity || 
        (activity as any).tokens || 
        '0'
      const shares = typeof sharesValue === 'string' ? parseFloat(sharesValue) : (sharesValue || 0)
      
      // Get price - API returns 'price' field directly (number)
      const priceValue = 
        activity.price ||  // PRIMARY: price is directly on activity
        (activity as any).priceNum || 
        (activity as any).costBasis || 
        (activity as any).avgPrice ||
        (activity as any).tradePrice ||
        (activity as any).fillPrice ||
        '0'
      const price = typeof priceValue === 'string' ? parseFloat(priceValue) : (priceValue || 0)
      
      // Get timestamp - API returns Unix timestamp as number
      let timestamp = (activity as any).timestamp || (activity as any).createdAt || (activity as any).created || ''
      
      // Convert Unix timestamp to ISO string if needed
      if (timestamp && typeof timestamp === 'number') {
        timestamp = new Date(timestamp * 1000).toISOString()
      } else if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
        // Handle string Unix timestamp
        timestamp = new Date(parseInt(timestamp) * 1000).toISOString()
      } else if (!timestamp) {
        timestamp = new Date().toISOString()
      }

      // Generate unique ID from transaction hash or index
      const id = (activity as any).transactionHash || activity.id || `activity-${index}`

      return {
        id,
        action,
        market: marketQuestion,
        shares: Math.round(shares),
        price: Math.round(price * 100) / 100,
        time: formatTimeAgo(timestamp),
        timestamp,
      }
    })
    // Don't filter - show all activities even if some fields are missing
}

// Transform positions to expiration timeline
export function transformExpirationTimeline(positions: Position[]): ExpirationTimelineItem[] {
  return positions
    .map((pos) => ({
      date: pos.expiresAt,
      market: pos.market,
      value: pos.value,
      daysFromNow: daysFromNow(pos.expiresAt),
    }))
    .filter((item) => item.daysFromNow > 0) // Only future expirations
    .sort((a, b) => a.daysFromNow - b.daysFromNow) // Sort by soonest first
}

// Calculate PnL history from activity (simplified - groups by month)
export function calculatePnLHistory(activityData: PolymarketActivity[]): Array<{ date: string; pnl: number }> {
  if (!Array.isArray(activityData)) {
    return []
  }

  // Group activities by month and calculate cumulative PnL
  const monthlyPnL = new Map<string, number>()
  let cumulativePnL = 0

  activityData
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || 0).getTime()
      const timeB = new Date(b.timestamp || b.createdAt || 0).getTime()
      return timeA - timeB
    })
    .forEach((activity) => {
      const timestamp = activity.timestamp || activity.createdAt
      if (!timestamp) return

      const date = new Date(timestamp)
      const monthKey = date.toLocaleDateString('en-US', { month: 'short' })

      // Simplified PnL calculation based on activity type
      const price = parseFloat(activity.price || '0')
      const amount = parseFloat(activity.amount || '0')
      const type = activity.type?.toUpperCase() || ''

      // This is a simplified calculation - real PnL would need more context
      if (type.includes('SELL') || type.includes('CLOSE')) {
        cumulativePnL += price * amount * 0.1 // Assume 10% profit on sells (simplified)
      } else {
        cumulativePnL -= price * amount * 0.05 // Assume 5% cost on buys (simplified)
      }

      monthlyPnL.set(monthKey, cumulativePnL)
    })

  // Convert to array format
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months.map((month) => ({
    date: month,
    pnl: Math.round((monthlyPnL.get(month) || 0) * 100) / 100,
  }))
}

