"use client"

import { useState } from "react"
import { Search, TrendingUp, TrendingDown, Activity, DollarSign, Zap, Calendar, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Pie, PieChart, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { Position, ActivityLogItem, ExpirationTimelineItem } from "@/lib/types"
import { transformPositions, transformActivity, transformExpirationTimeline, calculatePnLHistory } from "@/lib/transformers"

export default function PolymarketAnalyzer() {
  const [walletAddress, setWalletAddress] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [timeframe, setTimeframe] = useState<"1M" | "3M" | "6M" | "1Y">("3M")
  const [positions, setPositions] = useState<Position[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([])
  const [pnlHistory, setPnLHistory] = useState<Array<{ date: string; pnl: number }>>([])
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!walletAddress) return
    setIsAnalyzing(true)
    setHasSearched(true)
    setError(null)

    try {
      // Fetch activity and positions in parallel
      const [activityRes, positionsRes] = await Promise.all([
        fetch(`/api/activity?user=${walletAddress}&limit=500`),
        fetch(`/api/positions?user=${walletAddress}`),
      ])

      if (!activityRes.ok || !positionsRes.ok) {
        const activityError = await activityRes.json().catch(() => ({}))
        const positionsError = await positionsRes.json().catch(() => ({}))
        throw new Error(activityError.error || positionsError.error || "Failed to fetch data")
      }

      const activityRaw = await activityRes.json()
      const positionsRaw = await positionsRes.json()

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
      let positionsData: any[] = []
      if (Array.isArray(positionsRaw)) {
        positionsData = positionsRaw
      } else if (positionsRaw && typeof positionsRaw === 'object') {
        // Try common response structures
        positionsData = positionsRaw.data || 
                       positionsRaw.items || 
                       positionsRaw.results || 
                       positionsRaw.positions ||
                       (positionsRaw.positions && Array.isArray(positionsRaw.positions) ? positionsRaw.positions : []) ||
                       []
        
        // If still empty, check if the object itself contains position-like data
        if (positionsData.length === 0 && Object.keys(positionsRaw).length > 0) {
          // Check if it's a single position object
          if (positionsRaw.conditionId || positionsRaw.market || positionsRaw.shares) {
            positionsData = [positionsRaw]
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

      // Collect unique condition IDs to fetch market details
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

      // Fetch market details for unique condition IDs (limit to 50 to avoid too many requests)
      const marketsMap = new Map()
      const conditionIdsArray = Array.from(conditionIds).slice(0, 50)
      
      console.log(`Fetching market details for ${conditionIdsArray.length} conditions...`)
      
      // Fetch in batches to avoid overwhelming the API
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

      // Transform the data
      const transformedPositions = transformPositions(positionsData, marketsMap)
      const transformedActivity = transformActivity(activityData, marketsMap)
      const calculatedPnL = calculatePnLHistory(activityData)

      setPositions(transformedPositions)
      setActivityLog(transformedActivity)
      setPnLHistory(calculatedPnL.length > 0 ? calculatedPnL : [
        { date: "Jan", pnl: 0 },
        { date: "Feb", pnl: 0 },
        { date: "Mar", pnl: 0 },
        { date: "Apr", pnl: 0 },
        { date: "May", pnl: 0 },
        { date: "Jun", pnl: 0 },
      ])
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setPositions([])
      setActivityLog([])
      setPnLHistory([])
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

  const sectorData = positions.reduce(
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

  const totalValue = positions.reduce((acc, pos) => acc + pos.value, 0)
  const totalPnL = positions.reduce((acc, pos) => acc + pos.pnl, 0)

  const expectedValue = positions.reduce((acc, pos) => acc + pos.shares * pos.currentPrice, 0)
  const expectedReturn = totalValue > 0 ? ((expectedValue - totalValue) / totalValue) * 100 : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-accent/20 bg-card/50 backdrop-blur-sm shadow-lg shadow-accent/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight font-mono">
                POLYMARKET<span className="text-accent">_ANALYZER</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                &gt; TRACK_POSITIONS // MARKETS // EXPOSURE
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-lg shadow-accent/50" />
              <span className="text-xs text-accent font-mono hidden sm:inline">LIVE_FEED</span>
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
                        Total Value
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
                      <p className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? "text-accent" : "text-red-400"}`}>
                        {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-inner ${
                        totalPnL >= 0 ? "bg-accent/10 border-accent/20" : "bg-red-400/10 border-red-400/20"
                      }`}
                    >
                      {totalPnL >= 0 ? (
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
                      <p className="text-2xl font-bold text-foreground font-mono">{positions.length.toLocaleString('en-US')}</p>
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
                        Portfolio EV
                      </p>
                      <p className="text-2xl font-bold text-foreground font-mono">${expectedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p
                        className={`text-xs font-bold font-mono mt-1 ${expectedReturn >= 0 ? "text-accent" : "text-red-400"}`}
                      >
                        {expectedReturn >= 0 ? "+" : ""}
                        {expectedReturn.toFixed(1)}% exp. return
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20 shadow-inner">
                      <Target className="w-5 h-5 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sector Exposure - 1 column */}
              <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider">
                    &gt; Sector_Exposure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <ChartContainer
                      config={{
                        value: {
                          label: "Exposure",
                          color: "hsl(142, 76%, 36%)",
                        },
                      }}
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
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                  <div className="mt-4 space-y-2">
                    {sectorData.map((sector, index) => (
                      <div key={sector.sector} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-muted-foreground font-mono">{sector.sector}</span>
                        </div>
                        <span className="text-foreground font-mono font-bold">${sector.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
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

            {/* PNL Tracker at bottom */}
            <Card className="bg-card/50 border-accent/20 shadow-lg shadow-accent/5 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-mono text-accent uppercase tracking-wider">
                  &gt; PNL_Tracker
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    pnl: {
                      label: "P&L",
                      color: "hsl(142, 76%, 36%)",
                    },
                  }}
                  className="h-[350px] w-full min-w-0"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <defs>
                        <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(142, 76%, 36%, 0.15)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(142, 76%, 36%)"
                        style={{ fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: "bold" }}
                        tickLine={{ stroke: "hsl(142, 76%, 36%, 0.3)" }}
                        axisLine={{ stroke: "hsl(142, 76%, 36%, 0.3)" }}
                      />
                      <YAxis
                        stroke="hsl(142, 76%, 36%)"
                        style={{ fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: "bold" }}
                        tickLine={{ stroke: "hsl(142, 76%, 36%, 0.3)" }}
                        axisLine={{ stroke: "hsl(142, 76%, 36%, 0.3)" }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        cursor={{
                          stroke: "hsl(142, 76%, 36%)",
                          strokeWidth: 2,
                          strokeDasharray: "5 5",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="hsl(142, 76%, 36%)"
                        strokeWidth={4}
                        dot={{
                          fill: "hsl(142, 76%, 36%)",
                          strokeWidth: 3,
                          r: 6,
                          stroke: "hsl(var(--background))",
                        }}
                        activeDot={{
                          r: 8,
                          stroke: "hsl(142, 76%, 36%)",
                          strokeWidth: 3,
                          fill: "hsl(var(--background))",
                        }}
                        fill="url(#pnlGradient)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
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
