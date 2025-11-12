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
      
      // Get outcome/position - Polymarket API uses 'outcome' field
      // Need to know this early to properly convert prices for NO positions
      const outcome = pos.outcome || pos.side || pos.position || 'Yes'
      const isNo = outcome.toLowerCase() === 'no'
      
      // Get average price - prefer token-specific fields first
      // Token-specific fields (avgPrice, averagePrice, costBasis) are already correct for the outcome
      // Market-level fallbacks (price, avgPriceNum) might be YES prices and need conversion for NO
      let avgPrice = 0
      let avgPriceSource: string | null = null
      
      if (pos.avgPrice !== undefined && pos.avgPrice !== null && pos.avgPrice !== '') {
        avgPrice = typeof pos.avgPrice === 'string' ? parseFloat(pos.avgPrice) : (pos.avgPrice || 0)
        avgPriceSource = 'avgPrice'
      } else if (pos.averagePrice !== undefined && pos.averagePrice !== null && pos.averagePrice !== '') {
        avgPrice = typeof pos.averagePrice === 'string' ? parseFloat(pos.averagePrice) : (pos.averagePrice || 0)
        avgPriceSource = 'averagePrice'
      } else if (pos.costBasis !== undefined && pos.costBasis !== null && pos.costBasis !== '') {
        avgPrice = typeof pos.costBasis === 'string' ? parseFloat(pos.costBasis) : (pos.costBasis || 0)
        avgPriceSource = 'costBasis'
      } else if ((pos as any).price !== undefined && (pos as any).price !== null && (pos as any).price !== '') {
        avgPrice = typeof (pos as any).price === 'string' ? parseFloat((pos as any).price) : ((pos as any).price || 0)
        avgPriceSource = 'price' // Market-level, might be YES price
      } else if ((pos as any).avgPriceNum !== undefined && (pos as any).avgPriceNum !== null && (pos as any).avgPriceNum !== '') {
        avgPrice = typeof (pos as any).avgPriceNum === 'string' ? parseFloat((pos as any).avgPriceNum) : ((pos as any).avgPriceNum || 0)
        avgPriceSource = 'avgPriceNum' // Market-level, might be YES price
      }
      
      // Convert YES price to NO price if this is a NO position and we used a market-level fallback
      if (isNo && avgPriceSource && ['price', 'avgPriceNum'].includes(avgPriceSource)) {
        avgPrice = 1 - avgPrice
      }
      
      // Get current price - prefer token-specific fields first
      // Token-specific fields (curPrice, currentPrice) are already correct for the outcome
      // Market-level fallbacks (price, latestPrice, marketPrice) might be YES prices and need conversion for NO
      let currentPrice = 0
      let currentPriceSource: string | null = null
      
      if ((pos as any).curPrice !== undefined && (pos as any).curPrice !== null && (pos as any).curPrice !== '') {
        currentPrice = typeof (pos as any).curPrice === 'string' ? parseFloat((pos as any).curPrice) : ((pos as any).curPrice || 0)
        currentPriceSource = 'curPrice'
      } else if ((pos as any).currentPrice !== undefined && (pos as any).currentPrice !== null && (pos as any).currentPrice !== '') {
        currentPrice = typeof (pos as any).currentPrice === 'string' ? parseFloat((pos as any).currentPrice) : ((pos as any).currentPrice || 0)
        currentPriceSource = 'currentPrice'
      } else if ((pos as any).currentPriceNum !== undefined && (pos as any).currentPriceNum !== null && (pos as any).currentPriceNum !== '') {
        currentPrice = typeof (pos as any).currentPriceNum === 'string' ? parseFloat((pos as any).currentPriceNum) : ((pos as any).currentPriceNum || 0)
        currentPriceSource = 'currentPriceNum'
      } else if ((pos as any).price !== undefined && (pos as any).price !== null && (pos as any).price !== '') {
        currentPrice = typeof (pos as any).price === 'string' ? parseFloat((pos as any).price) : ((pos as any).price || 0)
        currentPriceSource = 'price' // Market-level, might be YES price
      } else if ((pos as any).latestPrice !== undefined && (pos as any).latestPrice !== null && (pos as any).latestPrice !== '') {
        currentPrice = typeof (pos as any).latestPrice === 'string' ? parseFloat((pos as any).latestPrice) : ((pos as any).latestPrice || 0)
        currentPriceSource = 'latestPrice' // Market-level, might be YES price
      } else if ((pos as any).marketPrice !== undefined && (pos as any).marketPrice !== null && (pos as any).marketPrice !== '') {
        currentPrice = typeof (pos as any).marketPrice === 'string' ? parseFloat((pos as any).marketPrice) : ((pos as any).marketPrice || 0)
        currentPriceSource = 'marketPrice' // Market-level, might be YES price
      } else if (avgPrice > 0) {
        currentPrice = avgPrice
        currentPriceSource = 'avgPriceFallback'
        // avgPrice is already converted for NO positions if needed (see lines 137-139)
      }
      
      // Convert YES price to NO price if this is a NO position and we used a market-level fallback
      // Note: avgPriceFallback doesn't need conversion because avgPrice was already converted if needed
      if (isNo && currentPriceSource && ['price', 'latestPrice', 'marketPrice'].includes(currentPriceSource)) {
        currentPrice = 1 - currentPrice
      }
      
      // Use currentValue if available, otherwise calculate from shares * currentPrice
      const value = pos.currentValue !== undefined && pos.currentValue !== null 
        ? (typeof pos.currentValue === 'string' ? parseFloat(pos.currentValue) : pos.currentValue)
        : (shares * currentPrice)
      
      // Use cashPnl if available, otherwise calculate
      // cashPnl from API should already be correct for the outcome
      const pnl = pos.cashPnl !== undefined && pos.cashPnl !== null
        ? (typeof pos.cashPnl === 'string' ? parseFloat(pos.cashPnl) : pos.cashPnl)
        : ((currentPrice - avgPrice) * shares)
      
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

// Calculate PnL history from activity using FIFO matching (groups by month)
export function calculatePnLHistory(
  activityData: PolymarketActivity[],
  positionsData?: PolymarketPosition[]
): Array<{ date: string; pnl: number; cumulativePnL: number }> {
  if (!Array.isArray(activityData)) {
    return []
  }

  // Track open positions using FIFO (conditionId -> queue of {price, quantity, timestamp})
  const openPositions = new Map<string, Array<{ price: number; quantity: number; timestamp: number }>>()
  const monthlyPnL = new Map<string, number>() // "YYYY-MM" -> PNL

  // Helper functions to extract data from activity
  const getConditionId = (activity: PolymarketActivity): string | null => {
    return (activity as any).conditionId || (activity as any).condition_id || null
  }

  const getSide = (activity: PolymarketActivity): 'BUY' | 'SELL' => {
    const side = ((activity as any).side || activity.type || '').toUpperCase()
    if (side === 'SELL' || side.includes('SELL') || side.includes('SALE')) {
      return 'SELL'
    }
    return 'BUY'
  }

  const getSize = (activity: PolymarketActivity): number => {
    const size = (activity as any).size || activity.amount || '0'
    return typeof size === 'string' ? parseFloat(size) : (size || 0)
  }

  const getPrice = (activity: PolymarketActivity): number => {
    const price = activity.price || (activity as any).fillPrice || (activity as any).tradePrice || '0'
    return typeof price === 'string' ? parseFloat(price) : (price || 0)
  }

  const getTimestamp = (activity: PolymarketActivity): number => {
    const timestamp = (activity as any).timestamp || (activity as any).createdAt || (activity as any).created || 0
    if (typeof timestamp === 'string') {
      if (/^\d+$/.test(timestamp)) {
        return parseInt(timestamp)
      }
      return new Date(timestamp).getTime() / 1000
    }
    if (typeof timestamp === 'number') {
      // If timestamp is in milliseconds, convert to seconds
      return timestamp > 1e10 ? Math.floor(timestamp / 1000) : timestamp
    }
    return 0
  }

  const getMonthKey = (timestamp: number): string => {
    if (timestamp === 0) {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
    const date = new Date(timestamp * 1000)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  // Filter and sort activity chronologically (oldest first)
  // Only include activities with valid conditionId, size, and price
  const validActivities = activityData.filter((activity) => {
    const conditionId = getConditionId(activity)
    const size = getSize(activity)
    const price = getPrice(activity)
    return conditionId && size > 0 && price >= 0
  })

  const sortedActivity = validActivities.sort((a, b) => {
    const timeA = getTimestamp(a)
    const timeB = getTimestamp(b)
    return timeA - timeB
  })

  // Process activity to calculate realized PNL
  for (const activity of sortedActivity) {
    const conditionId = getConditionId(activity)
    const side = getSide(activity)
    const size = getSize(activity)
    const price = getPrice(activity)
    const timestamp = getTimestamp(activity)

    const monthKey = getMonthKey(timestamp)

    if (side === 'BUY') {
      // Add to open positions (FIFO queue)
      if (!openPositions.has(conditionId)) {
        openPositions.set(conditionId, [])
      }
      openPositions.get(conditionId)!.push({
        price,
        quantity: size,
        timestamp
      })
    } else if (side === 'SELL') {
      // Match against open positions using FIFO
      let remainingSell = size
      const positions = openPositions.get(conditionId) || []

      while (remainingSell > 0 && positions.length > 0) {
        const oldestPosition = positions[0]
        const buyPrice = oldestPosition.price
        const buyQuantity = oldestPosition.quantity

        if (buyQuantity <= remainingSell) {
          // Close entire position
          const realizedPnL = (price - buyPrice) * buyQuantity
          monthlyPnL.set(monthKey, (monthlyPnL.get(monthKey) || 0) + realizedPnL)
          remainingSell -= buyQuantity
          positions.shift()
        } else {
          // Partial close
          const realizedPnL = (price - buyPrice) * remainingSell
          monthlyPnL.set(monthKey, (monthlyPnL.get(monthKey) || 0) + realizedPnL)
          oldestPosition.quantity -= remainingSell
          remainingSell = 0
        }
      }
    }
  }

  // Calculate unrealized PNL from current positions
  let unrealizedPnL = 0
  if (positionsData && Array.isArray(positionsData)) {
    for (const position of positionsData) {
      const conditionId = getConditionId(position as any)
      const size = (position as any).size || parseFloat(position.shares || '0')
      const avgPrice = parseFloat((position as any).avgPrice || (position as any).averagePrice || '0')
      const currentPrice = parseFloat((position as any).curPrice || (position as any).currentPrice || position.currentPrice || '0')

      if (conditionId && size > 0 && avgPrice >= 0 && currentPrice >= 0) {
        unrealizedPnL += (currentPrice - avgPrice) * size
      }
    }
  }

  // Add unrealized PNL to most recent month
  if (sortedActivity.length > 0) {
    const mostRecentTimestamp = getTimestamp(sortedActivity[sortedActivity.length - 1])
    const mostRecentMonth = getMonthKey(mostRecentTimestamp)
    monthlyPnL.set(mostRecentMonth, (monthlyPnL.get(mostRecentMonth) || 0) + unrealizedPnL)
  } else if (unrealizedPnL !== 0) {
    const currentMonth = getMonthKey(0)
    monthlyPnL.set(currentMonth, (monthlyPnL.get(currentMonth) || 0) + unrealizedPnL)
  }

  // Build monthly data with cumulative PNL
  const allMonths = Array.from(monthlyPnL.keys()).sort()
  let cumulativePnL = 0
  const result: Array<{ date: string; pnl: number; cumulativePnL: number }> = []

  for (const month of allMonths) {
    const monthlyPnLValue = monthlyPnL.get(month) || 0
    cumulativePnL += monthlyPnLValue
    result.push({
      date: month,
      pnl: Math.round(monthlyPnLValue * 100) / 100,
      cumulativePnL: Math.round(cumulativePnL * 100) / 100
    })
  }

  return result
}

