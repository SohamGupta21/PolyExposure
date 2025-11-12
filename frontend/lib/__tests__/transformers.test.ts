import { describe, it, expect } from 'vitest'
import { calculatePnLHistory } from '../transformers'
import type { PolymarketActivity, PolymarketPosition } from '../types'

describe('calculatePnLHistory', () => {
  const createActivity = (
    conditionId: string,
    side: 'BUY' | 'SELL',
    size: number,
    price: number,
    timestamp: number
  ): PolymarketActivity => {
    return {
      id: `activity-${Date.now()}`,
      type: side,
      user: '0x123',
      market: conditionId,
      outcome: 'Yes',
      amount: size.toString(),
      price: price.toString(),
      timestamp: timestamp.toString(),
      conditionId: conditionId as any,
      side: side as any,
      size: size as any,
    } as PolymarketActivity
  }

  const createPosition = (
    conditionId: string,
    size: number,
    avgPrice: number,
    currentPrice: number
  ): PolymarketPosition => {
    return {
      id: `position-${Date.now()}`,
      user: '0x123',
      market: conditionId,
      outcome: 'Yes',
      shares: size.toString(),
      avgPrice: avgPrice.toString(),
      currentPrice: currentPrice.toString(),
      conditionId: conditionId as any,
      size: size as any,
      curPrice: currentPrice as any,
    } as PolymarketPosition
  }

  describe('simple buy/sell scenarios', () => {
    it('should calculate PNL for simple buy and sell', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800), // Jan 15, 2024
        createActivity('cond1', 'SELL', 10, 0.6, 1705563600), // Jan 20, 2024
      ]

      const result = calculatePnLHistory(activity)

      expect(result.length).toBe(1)
      expect(result[0].date).toBe('2024-01')
      expect(result[0].pnl).toBeCloseTo(1.0, 2) // (0.6 - 0.5) * 10
      expect(result[0].cumulativePnL).toBeCloseTo(1.0, 2)
    })

    it('should handle loss scenario', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.6, 1705294800),
        createActivity('cond1', 'SELL', 10, 0.4, 1705563600),
      ]

      const result = calculatePnLHistory(activity)

      expect(result[0].pnl).toBeCloseTo(-2.0, 2) // (0.4 - 0.6) * 10
      expect(result[0].cumulativePnL).toBeCloseTo(-2.0, 2)
    })
  })

  describe('FIFO matching', () => {
    it('should match multiple buys with FIFO', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800), // Jan 15
        createActivity('cond1', 'BUY', 5, 0.6, 1705563600),  // Jan 20
        createActivity('cond1', 'SELL', 12, 0.7, 1705650000), // Jan 21
      ]

      const result = calculatePnLHistory(activity)

      // Should match: 10 at $0.5 + 2 at $0.6
      // PNL: (0.7 - 0.5) * 10 + (0.7 - 0.6) * 2 = 2.0 + 0.2 = 2.2
      expect(result[0].pnl).toBeCloseTo(2.2, 2)
    })

    it('should handle partial sell', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800),
        createActivity('cond1', 'SELL', 7, 0.6, 1705563600),
      ]

      const result = calculatePnLHistory(activity)

      // Realized PNL: (0.6 - 0.5) * 7 = 0.7
      expect(result[0].pnl).toBeCloseTo(0.7, 2)
    })
  })

  describe('monthly grouping', () => {
    it('should group PNL by month', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800), // Jan 15, 2024
        createActivity('cond1', 'SELL', 10, 0.6, 1705563600), // Jan 20, 2024
        createActivity('cond2', 'BUY', 5, 0.4, 1708156800),   // Feb 18, 2024
        createActivity('cond2', 'SELL', 5, 0.5, 1708243200), // Feb 19, 2024
      ]

      const result = calculatePnLHistory(activity)

      expect(result.length).toBe(2)
      expect(result[0].date).toBe('2024-01')
      expect(result[1].date).toBe('2024-02')
      expect(result[0].cumulativePnL).toBeCloseTo(1.0, 2)
      expect(result[1].cumulativePnL).toBeCloseTo(1.5, 2) // 1.0 + 0.5
    })
  })

  describe('cumulative PNL tracking', () => {
    it('should track cumulative PNL correctly', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800), // Jan
        createActivity('cond1', 'SELL', 10, 0.6, 1705563600), // Jan
        createActivity('cond2', 'BUY', 5, 0.4, 1708156800),   // Feb
        createActivity('cond2', 'SELL', 5, 0.3, 1708243200), // Feb (loss)
      ]

      const result = calculatePnLHistory(activity)

      expect(result[0].cumulativePnL).toBeCloseTo(1.0, 2)  // Jan: +1.0
      expect(result[1].cumulativePnL).toBeCloseTo(0.5, 2)  // Feb: +1.0 - 0.5 = 0.5
    })
  })

  describe('unrealized PNL from positions', () => {
    it('should include unrealized PNL from positions', () => {
      const activity: PolymarketActivity[] = []
      const positions: PolymarketPosition[] = [
        createPosition('cond1', 10, 0.5, 0.6),
      ]

      const result = calculatePnLHistory(activity, positions)

      // Unrealized PNL: (0.6 - 0.5) * 10 = 1.0
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      const monthData = result.find((d) => d.date === currentMonth)
      expect(monthData).toBeDefined()
      expect(monthData!.pnl).toBeCloseTo(1.0, 2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty activity', () => {
      const result = calculatePnLHistory([])
      expect(result).toEqual([])
    })

    it('should handle invalid activity data', () => {
      const result = calculatePnLHistory(null as any)
      expect(result).toEqual([])
    })

    it('should skip activities without conditionId', () => {
      const activity: PolymarketActivity[] = [
        {
          id: '1',
          type: 'BUY',
          user: '0x123',
          market: 'market1',
          outcome: 'Yes',
          amount: '10',
          price: '0.5',
          timestamp: '1705294800',
        } as PolymarketActivity,
      ]

      const result = calculatePnLHistory(activity)
      // Activities without conditionId should be skipped, so no PNL entries should be created
      // unless there are positions (which there aren't in this test)
      expect(result.length).toBe(0)
    })

    it('should handle multiple conditions', () => {
      const activity: PolymarketActivity[] = [
        createActivity('cond1', 'BUY', 10, 0.5, 1705294800),
        createActivity('cond1', 'SELL', 10, 0.6, 1705563600),
        createActivity('cond2', 'BUY', 5, 0.4, 1705563600),
        createActivity('cond2', 'SELL', 5, 0.5, 1705563600),
      ]

      const result = calculatePnLHistory(activity)

      // Both in same month: 1.0 + 0.5 = 1.5
      expect(result[0].pnl).toBeCloseTo(1.5, 2)
    })
  })
})

