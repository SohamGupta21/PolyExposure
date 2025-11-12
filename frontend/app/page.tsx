"use client"

import { useState } from "react"
import { Search, TrendingUp, TrendingDown, Activity, DollarSign, Zap, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Position, ActivityLogItem, ExpirationTimelineItem } from "@/lib/types"
import { transformPositions, transformActivity, transformExpirationTimeline } from "@/lib/transformers"

export default function PolyPortfolio() {
  const [walletAddress, setWalletAddress] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y">("3M")
  const [positions, setPositions] = useState<Position[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([])
  const [positionsValue, setPositionsValue] = useState<number | null>(null)
  const [totalPnL, setTotalPnL] = useState<number | null>(null)
  const [activePositionsCount, setActivePositionsCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectorExposure, setSectorExposure] = useState<Array<{ sector: string; value: number; percentage: number }>>([])
  const [isLoadingSectors, setIsLoadingSectors] = useState(false)
  const [unrealizedProfit, setUnrealizedProfit] = useState<number | null>(null)
  const [unrealizedProfitROI, setUnrealizedProfitROI] = useState<number | null>(null)

  const handleAnalyze = async () => {
    if (!walletAddress) return
    setIsAnalyzing(true)
    setHasSearched(true)
    setError(null)

    try {
      // Fetch activity, positions, value, total PnL, and unrealized profit in parallel
      const [activityRes, positionsRes, valueRes, totalPnLRes, unrealizedProfitRes] = await Promise.all([
        fetch(`/api/activity?user=${walletAddress}&limit=500`),
        fetch(`/api/positions?user=${walletAddress}`),
        fetch(`/api/value?user=${walletAddress}`),
        fetch(`/api/total-pnl?user=${walletAddress}`),
        fetch(`/api/unrealized-profit?user=${walletAddress}`),
      ])

      // Fetch sector exposure separately (may take longer due to API calls)
      setIsLoadingSectors(true)
      setSectorExposure([])
      
      // Fetch sector exposure in background
      fetch(`/api/sector-exposure?user=${walletAddress}`)
        .then(async (sectorRes) => {
          if (sectorRes.ok) {
            const sectorData = await sectorRes.json()
            if (sectorData && sectorData.sectors && Array.isArray(sectorData.sectors)) {
              setSectorExposure(sectorData.sectors)
            }
          }
        })
        .catch((err) => {
          console.warn("Failed to fetch sector exposure:", err)
        })
        .finally(() => {
          setIsLoadingSectors(false)
        })

      if (!activityRes.ok || !positionsRes.ok) {
        const activityError = await activityRes.json().catch(() => ({}))
        const positionsError = await positionsRes.json().catch(() => ({}))
        throw new Error(activityError.error || positionsError.error || "Failed to fetch data")
      }

      const activityRaw = await activityRes.json()
      const positionsRaw = await positionsRes.json()
      
      // Parse value response - API returns array: [{'user': '...', 'value': ...}]
      let valueData: number | null = null
      if (valueRes.ok) {
        try {
          const valueRaw = await valueRes.json()
          // API returns an array with one object: [{'user': '...', 'value': ...}]
          if (Array.isArray(valueRaw) && valueRaw.length > 0) {
            valueData = valueRaw[0].value || null
          } else if (typeof valueRaw === 'number') {
            valueData = valueRaw
          } else if (valueRaw && typeof valueRaw === 'object') {
            valueData = valueRaw.value || valueRaw.totalValue || valueRaw.positionsValue || null
          }
        } catch (err) {
          console.warn("Failed to parse value response:", err)
        }
      }
      
      // Parse total PnL response
      let totalPnLData: number | null = null
      if (totalPnLRes.ok) {
        try {
          const totalPnLRaw = await totalPnLRes.json()
          if (totalPnLRaw && typeof totalPnLRaw === 'object') {
            totalPnLData = totalPnLRaw.totalPnL || null
          }
        } catch (err) {
          console.warn("Failed to parse total PnL response:", err)
        }
      }
      
      // Parse unrealized profit response
      let unrealizedProfitData: number | null = null
      let unrealizedProfitROIData: number | null = null
      if (unrealizedProfitRes.ok) {
        try {
          const unrealizedProfitRaw = await unrealizedProfitRes.json()
          if (unrealizedProfitRaw && typeof unrealizedProfitRaw === 'object') {
            unrealizedProfitData = unrealizedProfitRaw.unrealizedProfit || null
            unrealizedProfitROIData = unrealizedProfitRaw.roi || null
          }
        } catch (err) {
          console.warn("Failed to parse unrealized profit response:", err)
        }
      }

      // Check for API errors in response
      if (activityRaw.error) {
        throw new Error(activityRaw.error)
      }
      if (positionsRaw.error) {
        throw new Error(positionsRaw.error)
      }

      // Extract the actual data array from the response
      // Polymarket API might return { data: [...] } or just [...]
      const activityData = Array.isArray(activityRaw) 
        ? activityRaw 
        : activityRaw.data || activityRaw.items || activityRaw.results || []
      
      // Handle different possible response structures for positions
      // Backend now returns { data: [...], count: N } after pagination
      let positionsData: any[] = []
      let positionsCount: number | null = null
      
      if (Array.isArray(positionsRaw)) {
        positionsData = positionsRaw
        positionsCount = positionsRaw.length
      } else if (positionsRaw && typeof positionsRaw === 'object') {
        // Backend returns { data: [...], count: N }
        if (positionsRaw.data && Array.isArray(positionsRaw.data)) {
          positionsData = positionsRaw.data
          positionsCount = positionsRaw.count !== undefined ? positionsRaw.count : positionsRaw.data.length
        } else {
          // Try common response structures
          positionsData = positionsRaw.items || 
                         positionsRaw.results || 
                         positionsRaw.positions ||
                         []
          positionsCount = positionsData.length
        }
        
        // If still empty, check if the object itself contains position-like data
        if (positionsData.length === 0 && Object.keys(positionsRaw).length > 0) {
          // Check if it's a single position object
          if (positionsRaw.conditionId || positionsRaw.market || positionsRaw.shares) {
            positionsData = [positionsRaw]
            positionsCount = 1
          }
        }
      }

      // Debug: Log the actual API responses (after extracting data)
      console.log("Activity API Response:", activityRaw)
      console.log("First Activity Item:", activityData[0])
      console.log("Positions API Response (RAW):", JSON.stringify(positionsRaw, null, 2))
      console.log("Positions Data Length:", positionsData.length)
      console.log("Positions Data Type:", typeof positionsData, Array.isArray(positionsData))
      if (positionsData.length > 0) {
        console.log("First Position Item:", positionsData[0])
        console.log("All Position Items:", positionsData)
      } else {
        console.warn("No positions data found in response. Raw response structure:", {
          isArray: Array.isArray(positionsRaw),
          keys: positionsRaw && typeof positionsRaw === 'object' ? Object.keys(positionsRaw) : 'not an object',
          raw: positionsRaw
        })
      }

      // Set basic state immediately so UI can render
      setPositionsValue(valueData)
      setTotalPnL(totalPnLData)
      setActivePositionsCount(positionsCount)
      setUnrealizedProfit(unrealizedProfitData)
      setUnrealizedProfitROI(unrealizedProfitROIData)

      // Transform data without market details first (for immediate display)
      const initialTransformedPositions = transformPositions(positionsData, new Map())
      const initialTransformedActivity = transformActivity(activityData, new Map())
      
      setPositions(initialTransformedPositions)
      setActivityLog(initialTransformedActivity)

      // Set analyzing to false so UI can render immediately
      setIsAnalyzing(false)

      // Collect unique condition IDs to fetch market details in background
      const conditionIds = new Set<string>()
      
      activityData.forEach((item: any) => {
        // Try to get condition ID from various possible fields
        const conditionId = item.conditionId || item.condition?.id || item.market || item.marketId
        if (conditionId && typeof conditionId === 'string' && conditionId.startsWith('0x')) {
          conditionIds.add(conditionId)
        }
        // Also check if market info is already embedded
        if (item.market && typeof item.market === 'object') {
          const marketId = item.market.id || item.market.slug
          if (marketId) {
            conditionIds.add(marketId)
          }
        }
        if (item.condition && item.condition.market) {
          const marketId = item.condition.market.id || item.condition.market.slug || item.condition.id
          if (marketId) {
            conditionIds.add(marketId)
          }
        }
      })
      
      positionsData.forEach((item: any) => {
        const conditionId = item.conditionId || item.condition?.id || item.market || item.marketId
        if (conditionId && typeof conditionId === 'string' && conditionId.startsWith('0x')) {
          conditionIds.add(conditionId)
        }
        if (item.market && typeof item.market === 'object') {
          const marketId = item.market.id || item.market.slug
          if (marketId) {
            conditionIds.add(marketId)
          }
        }
        if (item.condition && item.condition.market) {
          const marketId = item.condition.market.id || item.condition.market.slug || item.condition.id
          if (marketId) {
            conditionIds.add(marketId)
          }
        }
      })

      // Fetch market details in background (non-blocking)
      const conditionIdsArray = Array.from(conditionIds).slice(0, 50)
      
      if (conditionIdsArray.length > 0) {
        console.log(`Fetching market details for ${conditionIdsArray.length} conditions in background...`)
        
        // Fetch in batches in background
        const fetchMarketDetails = async () => {
          const marketsMap = new Map()
          const batchSize = 10
          
          for (let i = 0; i < conditionIdsArray.length; i += batchSize) {
            const batch = conditionIdsArray.slice(i, i + batchSize)
            const marketPromises = batch.map(async (conditionId) => {
              try {
                const marketRes = await fetch(`/api/conditions/${conditionId}`)
                if (marketRes.ok) {
                  const marketData = await marketRes.json()
                  return { id: conditionId, data: marketData }
                }
              } catch (e) {
                console.warn(`Failed to fetch market ${conditionId}:`, e)
              }
              return null
            })
            
            const marketResults = await Promise.all(marketPromises)
            marketResults.forEach((result) => {
              if (result && result.data) {
                marketsMap.set(result.id, result.data)
              }
            })
            
            // Small delay between batches to be respectful to the API
            if (i + batchSize < conditionIdsArray.length) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
          
          console.log(`Fetched ${marketsMap.size} market details`)
          
          // Update positions and activity with market details once fetched
          const transformedPositions = transformPositions(positionsData, marketsMap)
          const transformedActivity = transformActivity(activityData, marketsMap)
          
          setPositions(transformedPositions)
          setActivityLog(transformedActivity)
        }
        
        // Start fetching in background (don't await)
        fetchMarketDetails().catch((err) => {
          console.warn("Failed to fetch market details:", err)
        })
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setPositions([])
      setActivityLog([])
      setPositionsValue(null)
      setTotalPnL(null)
      setActivePositionsCount(null)
      setSectorExposure([])
      setIsLoadingSectors(false)
      setUnrealizedProfit(null)
      setUnrealizedProfitROI(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Calculate derived data from positions
  const expirationTimeline = transformExpirationTimeline(positions)

  const getFilteredTimeline = () => {
    const dayLimits = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }
    return expirationTimeline.filter((item) => item.daysFromNow <= dayLimits[timeframe])
  }

  const filteredTimeline = getFilteredTimeline()

  // Use sector exposure from API if available, otherwise fall back to calculating from positions
  // Only use fallback when NOT loading and sector exposure is empty
  const sectorData = isLoadingSectors
    ? [] // Empty during loading to show loading state
    : sectorExposure.length > 0 
      ? sectorExposure.map(s => ({ sector: s.sector, value: s.value }))
      : positions.reduce(
          (acc, pos) => {
            const existing = acc.find((s) => s.sector === pos.sector)
            if (existing) {
              existing.value += pos.value
            } else {
              acc.push({ sector: pos.sector, value: pos.value })
            }
            return acc
          },
          [] as { sector: string; value: number }[],
        )

  const COLORS = ["hsl(142, 76%, 36%)", "hsl(180, 76%, 36%)", "hsl(270, 76%, 56%)", "hsl(330, 76%, 56%)"]

  // Use positions value from API if available, otherwise fall back to calculating from positions
  const totalValue = positionsValue !== null ? positionsValue : positions.reduce((acc, pos) => acc + pos.value, 0)
  // Use total PnL from API (Realized PnL + Current Value), otherwise fall back to calculating from positions
  const displayTotalPnL = totalPnL !== null ? totalPnL : positions.reduce((acc, pos) => acc + pos.pnl, 0)

  // Use unrealized profit from API if available
  const displayUnrealizedProfit = unrealizedProfit !== null ? unrealizedProfit : 0
  const displayUnrealizedProfitROI = unrealizedProfitROI !== null ? unrealizedProfitROI : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-accent/20 bg-card/50 backdrop-blur-sm shadow-lg shadow-accent/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight font-mono">
                POLY<span className="text-accent">_PORTFOLIO</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                &gt; TRACK_POSITIONS // MARKETS // EXPOSURE
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-12">
          <div className="max-w-3xl mx-auto">
            <label htmlFor="wallet" className="block text-sm font-medium text-accent mb-3 font-mono">
              &gt; WALLET_ADDRESS
            </label>
            <div className="flex gap-3">
              <Input
                id="wallet"
                type="text"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="flex-1 h-12 bg-card/50 border-accent/30 text-foreground placeholder:text-muted-foreground font-mono focus:border-accent focus:ring-accent/20 shadow-lg shadow-accent/5"
              />
              <Button
                onClick={handleAnalyze}
                disabled={!walletAddress || isAnalyzing}
                className="h-12 px-8 bg-accent hover:bg-accent/90 text-black font-bold font-mono shadow-lg shadow-accent/20 border border-accent/50"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>ANALYZING</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>ANALYZE</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && hasSearched && !isAnalyzing && (
          <div className="mb-6 max-w-3xl mx-auto">
            <Card className="bg-red-500/10 border-red-500/30 shadow-lg">
              <CardContent className="p-4">
                <p className="text-sm text-red-400 font-mono">
                  &gt; ERROR: {error}
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Please check the wallet address and try again.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !isAnalyzing && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Summary Cards */}
              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm hover:border-accent/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                        Positions Value
                      </p>
                      <p className="text-2xl font-bold text-foreground font-mono">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20 shadow-inner">
                      <DollarSign className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm hover:border-accent/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">Total P&L</p>
                      <p className={`text-2xl font-bold font-mono ${displayTotalPnL >= 0 ? "text-accent" : "text-red-400"}`}>
                        {displayTotalPnL >= 0 ? "+" : ""}${displayTotalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
                        displayTotalPnL >= 0 ? "bg-accent/10 border-accent/20" : "bg-red-400/10 border-red-400/20"
                      }`}
                    >
                      {displayTotalPnL >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-accent" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm hover:border-accent/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                        Active Positions
                      </p>
                      <p className="text-2xl font-bold text-foreground font-mono">
                        {(activePositionsCount !== null ? activePositionsCount : positions.length).toLocaleString('en-US')}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20 shadow-inner">
                      <Activity className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm hover:border-accent/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                        Unrealized Profit
                      </p>
                      <p className={`text-2xl font-bold font-mono ${displayUnrealizedProfit >= 0 ? "text-accent" : "text-red-400"}`}>
                        {displayUnrealizedProfit >= 0 ? "+" : ""}${displayUnrealizedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p
                        className={`text-xs font-bold font-mono mt-1 ${displayUnrealizedProfitROI >= 0 ? "text-accent" : "text-red-400"}`}
                      >
                        {displayUnrealizedProfitROI >= 0 ? "+" : ""}
                        {displayUnrealizedProfitROI.toFixed(2)}% ROI
                      </p>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
                        displayUnrealizedProfit >= 0 ? "bg-accent/10 border-accent/20" : "bg-red-400/10 border-red-400/20"
                      }`}
                    >
                      {displayUnrealizedProfit >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-accent" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sector Exposure - 1 column */}
              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider flex items-center gap-2">
                    &gt; Sectors
                    {isLoadingSectors && (
                      <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingSectors ? (
                    <div className="flex flex-col items-center justify-center h-[220px] space-y-4">
                      <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                      <p className="text-xs text-muted-foreground font-mono text-center">
                        Loading sector labels...
                        <br />
                        <span className="text-[10px]">This may take a moment</span>
                      </p>
                    </div>
                  ) : sectorData.length === 0 ? (
                    <div className="flex items-center justify-center h-[220px]">
                      <p className="text-sm text-muted-foreground font-mono">No sector data available</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center">
                        <ChartContainer
                          config={
                            sectorData.reduce((acc, sector, index) => {
                              acc[sector.sector] = {
                                label: sector.sector,
                                color: COLORS[index % COLORS.length],
                              }
                              return acc
                            }, {} as Record<string, { label: string; color: string }>)
                          }
                          className="h-[220px] w-full max-w-[220px] min-w-0"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sectorData}
                                dataKey="value"
                                nameKey="sector"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={40}
                                paddingAngle={2}
                                label={false}
                              >
                                {sectorData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent nameKey="sector" />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                      <div className="mt-4 positions-scroll overflow-y-auto max-h-[200px]">
                        <div className="space-y-3 pr-2">
                          {sectorData.map((sector, index) => (
                            <div key={sector.sector} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded flex-shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-foreground font-mono font-bold text-lg">{sector.sector}</span>
                              <span className="text-foreground font-mono text-sm ml-auto">
                                {sector.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Positions Table - 2 columns */}
              <Card className="lg:col-span-2 bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider">
                    &gt; Open_Positions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="positions-scroll overflow-x-auto overflow-y-auto max-h-[450px]">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                        <tr className="border-b border-accent/20">
                          <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            Market
                          </th>
                          <th className="text-left py-2 px-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            Position
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            Shares
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            Value
                          </th>
                          <th className="text-right py-2 px-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                            P&L
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-muted-foreground font-mono">
                              {error ? `Error: ${error}` : "No positions found"}
                            </td>
                          </tr>
                        ) : (
                          positions.map((position, index) => (
                          <tr
                            key={index}
                            className="border-b border-accent/10 last:border-0 hover:bg-accent/5 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <div className="text-sm font-medium text-foreground">{position.market}</div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">{position.sector}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                                  position.position === "Yes"
                                    ? "bg-accent/10 text-accent border-accent/30"
                                    : "bg-muted/50 text-muted-foreground border-muted"
                                }`}
                              >
                                {position.position.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-sm text-foreground font-mono">
                              {position.shares.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right text-sm font-medium text-foreground font-mono">
                              ${position.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span
                                className={`text-sm font-bold font-mono ${
                                  position.pnl >= 0 ? "text-accent" : "text-red-400"
                                }`}
                              >
                                {position.pnl >= 0 ? "+" : ""}${position.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Log - 1 column */}
              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Activity_Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="positions-scroll overflow-y-auto max-h-[450px]">
                    <div className="space-y-3 pr-2">
                      {activityLog.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                          {error ? `Error: ${error}` : "No activity found"}
                        </div>
                      ) : (
                        activityLog.map((activity) => (
                        <div
                          key={activity.id}
                          className="border-l-2 border-accent/30 pl-3 py-2 hover:border-accent/60 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span
                              className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                                activity.action === "BUY" ? "bg-accent/20 text-accent" : "bg-red-400/20 text-red-400"
                              }`}
                            >
                              {activity.action}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{activity.time}</span>
                          </div>
                          <p className="text-sm text-foreground font-medium mb-1">{activity.market}</p>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-muted-foreground">{activity.shares} shares</span>
                            <span className="text-foreground">@${activity.price.toFixed(2)}</span>
                          </div>
                        </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Contract_Expiration_Timeline
                  </CardTitle>
                  <div className="flex gap-2">
                    {(["1M", "3M", "6M", "1Y"] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTimeframe(tf)}
                        className={`px-3 py-1 text-xs font-mono font-bold rounded border transition-colors ${
                          timeframe === tf
                            ? "bg-accent text-black border-accent"
                            : "bg-card/50 text-muted-foreground border-accent/20 hover:border-accent/40"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTimeline.length === 0 ? (
                  <div className="w-full text-center text-sm text-muted-foreground font-mono py-12">
                    No contracts expiring in this timeframe
                  </div>
                ) : (
                  <div className="positions-scroll overflow-y-auto max-h-[600px] pr-2">
                    <div className="space-y-6">
                      {/* Group contracts by expiration date */}
                      {(() => {
                        // Group by date
                        const grouped = filteredTimeline.reduce((acc, item) => {
                          const dateKey = item.date
                          if (!acc[dateKey]) {
                            acc[dateKey] = []
                          }
                          acc[dateKey].push(item)
                          return acc
                        }, {} as Record<string, typeof filteredTimeline>)

                      // Sort dates and calculate totals per date
                      const sortedDates = Object.keys(grouped).sort((a, b) => {
                        // Parse as local dates to avoid timezone issues
                        const [yearA, monthA, dayA] = a.split('-').map(Number)
                        const [yearB, monthB, dayB] = b.split('-').map(Number)
                        const dateA = new Date(yearA, monthA - 1, dayA)
                        const dateB = new Date(yearB, monthB - 1, dayB)
                        return dateA.getTime() - dateB.getTime()
                      })

                        return sortedDates.map((date) => {
                          const contracts = grouped[date]
                          const totalValue = contracts.reduce((sum, c) => sum + c.value, 0)
                          const daysUntil = contracts[0].daysFromNow
                          // Parse date as local date to avoid timezone issues
                          const [year, month, day] = date.split('-').map(Number)
                          const dateObj = new Date(year, month - 1, day)
                          const isSoon = daysUntil <= 7
                          const isVerySoon = daysUntil <= 3

                          return (
                            <div
                              key={date}
                              className={`border rounded-lg overflow-hidden transition-all ${
                                isVerySoon
                                  ? "border-red-400/50 bg-red-400/5"
                                  : isSoon
                                  ? "border-yellow-400/50 bg-yellow-400/5"
                                  : "border-accent/20 bg-accent/5"
                              }`}
                            >
                              {/* Date Header */}
                              <div
                                className={`px-4 py-3 border-b flex items-center justify-between ${
                                  isVerySoon
                                    ? "border-red-400/20 bg-red-400/10"
                                    : isSoon
                                    ? "border-yellow-400/20 bg-yellow-400/10"
                                    : "border-accent/10"
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                                      {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                                    </span>
                                    <span className="text-lg font-bold font-mono text-foreground">
                                      {dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  </div>
                                  <div className="h-8 w-px bg-accent/20" />
                                  <div className="flex flex-col">
                                    <span className="text-xs font-mono text-muted-foreground">
                                      {daysUntil === 0
                                        ? "Expires Today"
                                        : daysUntil === 1
                                        ? "Expires Tomorrow"
                                        : `${daysUntil} days`}
                                    </span>
                                    <span className="text-sm font-mono text-accent font-bold">
                                      {contracts.length} {contracts.length === 1 ? "contract" : "contracts"}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                                    Total Value
                                  </span>
                                  <span className="text-xl font-bold font-mono text-accent">
                                    ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>

                              {/* Contracts List */}
                              <div className="divide-y divide-accent/10">
                                {contracts.map((contract, idx) => (
                                  <div
                                    key={idx}
                                    className="px-4 py-3 hover:bg-accent/5 transition-colors flex items-start justify-between gap-4"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground leading-snug">
                                        {contract.market}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <span className="text-sm font-bold font-mono text-accent">
                                        ${contract.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!hasSearched && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent/20 shadow-lg shadow-accent/10">
              <Search className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2 font-mono">&gt; ENTER_WALLET_ADDRESS_TO_BEGIN</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto font-mono">
              Analyze Polymarket positions, view open markets, and track your portfolio exposure in real-time
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
