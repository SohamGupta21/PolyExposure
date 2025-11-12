import requests
import json
import os
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict


class PolymarketAPI:    
    BASE_URL = "https://data-api.polymarket.com"
    
    # Valid sector tags from Polymarket
    VALID_SECTORS = {
        'Politics', 'Sports', 'Finance', 'Crypto', 'Geopolitics', 
        'Earnings', 'Tech', 'Culture', 'World', 'Economy', 
        'Elections', 'Mentions'
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'User-Agent': 'PolyPortfolio/1.0'
        })
    
    def _request(self, method: str, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        try:
            response = self.session.request(method, f"{self.BASE_URL}{endpoint}", params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def _extract_list(self, data: Dict[str, Any]) -> list:
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get('data') or data.get('results') or []
        return []
    
    def get_activity(self, user: str, limit: int = 500, offset: int = 0) -> Dict[str, Any]:
        return self._request('GET', '/activity', {'user': user, 'limit': limit, 'offset': offset})
    
    def get_markets(self, limit: int = 100, offset: int = 0, active: Optional[bool] = None) -> Dict[str, Any]:
        params = {'limit': limit, 'offset': offset}
        if active is not None:
            params['active'] = str(active).lower()
        return self._request('GET', '/markets', params)
    
    def get_market(self, market_id: str) -> Dict[str, Any]:
        return self._request('GET', f'/markets/{market_id}')
    
    def get_user_positions(self, user: str, limit: int = 500) -> Dict[str, Any]:
        """
        Get all positions for a user using pagination.
        Uses default sizeThreshold (1.0) to filter out small positions.
        
        Args:
            user: The user's wallet address
            limit: Maximum number of positions to fetch per request (default 500)
        
        Returns:
            dict: Contains 'data' (list of all positions) and 'count' (total count)
        """
        all_positions = []
        offset = 0
        has_more = True
        
        while has_more:
            params = {
                'user': user,
                'limit': limit,
                'offset': offset
                # Using default sizeThreshold (1.0) to filter out small positions
            }
            
            result = self._request('GET', '/positions', params)
            
            if 'error' in result:
                return result
            
            positions_data = self._extract_list(result)
            
            if not positions_data:  # No more data
                has_more = False
            else:
                all_positions.extend(positions_data)
                
                # If we got fewer results than the limit, we've reached the end
                if len(positions_data) < limit:
                    has_more = False
                else:
                    offset += limit
        
        return {
            'data': all_positions,
            'count': len(all_positions)
        }
    
    def get_user_value(self, user: str) -> Dict[str, Any]:
        return self._request('GET', '/value', {'user': user})
    
    def get_closed_positions(self, user: str) -> Dict[str, Any]:
        return self._request('GET', '/closed-positions', {'user': user, 'limit': 5000})
    
    def calculate_total_pnl(self, user: str) -> Dict[str, Any]:
        """
        Calculate total PnL: Realized PnL (from closed positions) + Current Portfolio Value
        This matches the Polymarket dashboard calculation.
        """
        total_realized_pnl = 0.0
        total_value = 0.0
        
        # Get realized PnL from closed positions
        closed_positions_result = self.get_closed_positions(user)
        if 'error' in closed_positions_result:
            return closed_positions_result
        
        closed_positions_list = self._extract_list(closed_positions_result)
        # Sum realizedPnl from all closed positions
        total_realized_pnl = sum(self._to_float(pos.get('realizedPnl', 0)) for pos in closed_positions_list)
        
        # Get current portfolio value
        value_result = self.get_user_value(user)
        if 'error' in value_result:
            return value_result
        
        # Value endpoint returns array: [{'user': '...', 'value': ...}]
        value_data = value_result if isinstance(value_result, list) else []
        total_value = sum(self._to_float(item.get('value', 0)) for item in value_data)
        
        # Total PnL = Realized PnL + Current Portfolio Value
        full_pnl = total_realized_pnl + total_value
        
        return {
            'user': user,
            'realizedPnl': round(total_realized_pnl, 2),
            'currentValue': round(total_value, 2),
            'totalPnL': round(full_pnl, 2),
            'closedPositionsCount': len(closed_positions_list)
        }
    
    def calculate_unrealized_profit(self, user: str) -> Dict[str, Any]:
        """
        Calculate unrealized profit: Current Value - Total Cost (initialValue)
        Uses the same approach as the user's example code.
        """
        # Get all positions using pagination
        positions_result = self.get_user_positions(user)
        if 'error' in positions_result:
            return positions_result
        
        positions = positions_result.get('data', []) if isinstance(positions_result, dict) else self._extract_list(positions_result)
        
        total_cost = 0.0
        total_current_value = 0.0
        
        for position in positions:
            cost = self._to_float(position.get('initialValue', 0))
            current_value = self._to_float(position.get('currentValue', 0))
            
            total_cost += cost
            total_current_value += current_value
        
        unrealized_profit = total_current_value - total_cost
        roi = (unrealized_profit / total_cost * 100) if total_cost > 0 else 0.0
        
        return {
            'user': user,
            'totalCost': round(total_cost, 2),
            'currentValue': round(total_current_value, 2),
            'unrealizedProfit': round(unrealized_profit, 2),
            'roi': round(roi, 2),
            'positionsCount': len(positions)
        }
    
    def get_condition(self, condition_id: str) -> Dict[str, Any]:
        result = self._request('GET', f'/conditions/{condition_id}')
        if 'error' not in result:
            return result
        return self._request('GET', f'/markets/{condition_id}')
    
    def calculate_pnl_history(self, user: str, granularity: str = 'daily') -> Dict[str, Any]:
        closed_positions_result = self.get_closed_positions(user)
        closed_positions_list = self._extract_list(closed_positions_result) if 'error' not in closed_positions_result else []

        positions_result = self.get_user_positions(user)
        if 'error' in positions_result:
            return positions_result
        positions_list = positions_result.get('data', []) if isinstance(positions_result, dict) else self._extract_list(positions_result)

        period_realized_pnl = defaultdict(float)

        for closed_pos in closed_positions_list:
            # Prefer source PnL if present (assumed dollars)
            pnl_value = (closed_pos.get('pnl') or closed_pos.get('realizedPnl') or
                        closed_pos.get('cashPnl') or closed_pos.get('profit') or
                        closed_pos.get('realized_pnl') or closed_pos.get('cash_pnl'))

            if pnl_value is None:
                # Recompute in dollars if needed (prices 0–1 or dollar prices both fine)
                size = self._get_size(closed_pos)
                avg_price = self._get_avg_price(closed_pos)
                sell_price = (self._get_current_price(closed_pos) or
                            closed_pos.get('sellPrice') or
                            closed_pos.get('closePrice') or 0)
                if size is not None and avg_price is not None and sell_price is not None:
                    pnl_value = (float(sell_price) - float(avg_price)) * float(size)
                else:
                    pnl_value = 0.0

            pnl_value = self._to_float(pnl_value)

            ts = self._get_timestamp(closed_pos)
            if ts and ts > 0:
                date_key = self._get_date_key(ts, granularity)
            else:
                # No timestamp: use today's period, not epoch
                date_key = self._get_date_key(datetime.now().timestamp(), granularity)

            period_realized_pnl[date_key] += pnl_value

        # Unrealized PnL as of "today"
        unrealized_pnl = 0.0
        for p in positions_list:
            size = self._get_size(p)
            avg_price = self._get_avg_price(p)
            cur_price = self._get_current_price(p)
            if size is None or avg_price is None or cur_price is None:
                continue
            unrealized_pnl += (float(cur_price) - float(avg_price)) * float(size)

        if unrealized_pnl != 0.0:
            today_key = self._get_date_key(datetime.now().timestamp(), granularity)
            period_realized_pnl[today_key] += unrealized_pnl

        # Build sorted series; ensure _get_date_key returns sortable ISO-like keys
        all_periods = sorted(period_realized_pnl.keys())
        cumulative_pnl = 0.0
        pnl_data = []

        if not all_periods and granularity == 'daily':
            today = datetime.now()
            pnl_data = [{
                'date': (today - timedelta(days=i)).strftime('%Y-%m-%d'),
                'pnl': 0.0,
                'cumulativePnL': 0.0
            } for i in range(29, -1, -1)]
        else:
            for period in all_periods:
                val = period_realized_pnl[period]
                cumulative_pnl += val
                pnl_data.append({
                    'date': period,
                    'pnl': round(val, 2),
                    'cumulativePnL': round(cumulative_pnl, 2)
                })

        return {'user': user, 'data': pnl_data, 'totalPnL': round(cumulative_pnl, 2)}

    
    def _get_condition_id(self, item: Dict[str, Any]) -> Optional[str]:
        condition_id = item.get('conditionId') or item.get('condition_id')
        if condition_id:
            return str(condition_id)
        condition = item.get('condition')
        if isinstance(condition, dict):
            condition_id = condition.get('id')
            if condition_id:
                return str(condition_id)
        return None
    
    def _get_size(self, item: Dict[str, Any]) -> float:
        size = item.get('size') or item.get('shares') or item.get('quantity') or item.get('amount') or 0
        if 'sharesNum' in item:
            try:
                return float(item['sharesNum'])
            except (ValueError, TypeError):
                pass
        return self._to_float(size)
    
    def _get_avg_price(self, position: Dict[str, Any]) -> float:
        return self._to_float(position.get('avgPrice') or position.get('averagePrice') or position.get('costBasis') or 0)
    
    def _get_current_price(self, position: Dict[str, Any]) -> float:
        return self._to_float(position.get('curPrice') or position.get('currentPrice') or position.get('price') or 0)
    
    def _get_timestamp(self, item: Dict[str, Any]) -> int:
        timestamp = item.get('timestamp') or item.get('createdAt') or item.get('created') or 0
        
        if isinstance(timestamp, str):
            try:
                return int(timestamp) if timestamp.isdigit() else int(datetime.fromisoformat(timestamp.replace('Z', '+00:00')).timestamp())
            except (ValueError, AttributeError):
                return 0
        
        if isinstance(timestamp, (int, float)):
            return int(timestamp / 1000) if timestamp > 1e10 else int(timestamp)
        
        return 0
    
    def _get_date_key(self, timestamp: int, granularity: str = 'daily') -> str:
        dt = datetime.fromtimestamp(timestamp) if timestamp > 0 else datetime.now()
        fmt = '%Y-%m-%d' if granularity == 'daily' else '%Y-%m'
        return dt.strftime(fmt)
    
    def _to_float(self, value: Any) -> float:
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return 0.0
        return float(value) if value else 0.0
    
    def _normalize_sector(self, tag_label: str) -> str:
        """
        Normalize and validate sector tag.
        Returns a valid sector from VALID_SECTORS or 'Other' if not found.
        """
        if not tag_label:
            return 'Other'
        
        # Clean up the tag label
        tag_label = tag_label.strip()
        
        # Check if it's in the valid sectors list
        if tag_label in self.VALID_SECTORS:
            return tag_label
        
        # Return 'Other' for any tag not in the valid list
        return 'Other'
    
    def _find_valid_sector_from_tags(self, tags: list) -> str:
        """
        Find the first tag from the list that is in VALID_SECTORS.
        Returns 'Other' if none of the tags are valid sectors.
        """
        if not tags or not isinstance(tags, list):
            return 'Other'
        
        for tag in tags:
            # Extract label from tag (could be dict or string)
            if isinstance(tag, dict):
                label = tag.get('label', '')
            elif isinstance(tag, str):
                label = tag
            else:
                continue
            
            if label and label.strip() in self.VALID_SECTORS:
                return label.strip()
        
        # No valid sector found in tags
        return 'Other'
    
    def _load_cache(self, cache_file: str = 'market_labels_cache.json') -> Dict[str, str]:
        """
        Load cached slug-to-label mappings from file.
        Normalizes all cached values to ensure they're valid sectors.
        """
        cache = {}
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    raw_cache = json.load(f)
                    # Normalize all cached values
                    cache_needs_update = False
                    for slug, label in raw_cache.items():
                        normalized = self._normalize_sector(label)
                        cache[slug] = normalized
                        if normalized != label:
                            cache_needs_update = True
                    
                    # Update cache file if any values were normalized
                    if cache_needs_update:
                        self._save_cache(cache, cache_file)
            except Exception:
                return {}
        return cache
    
    def _save_cache(self, cache: Dict[str, str], cache_file: str = 'market_labels_cache.json'):
        """Save slug-to-label mappings to file."""
        try:
            with open(cache_file, 'w') as f:
                json.dump(cache, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")
    
    def _get_market_label(self, slug: str, cache: Dict[str, str]) -> str:
        """
        Get market sector label from Gamma API.
        First checks cache, then API if needed.
        Looks through all tags to find the first one in VALID_SECTORS.
        Returns 'Other' only if none of the tags are valid sectors.
        """
        if not slug:
            return 'Other'
        
        # Check cache first (cache is already normalized when loaded)
        if slug in cache:
            return cache[slug]
        
        try:
            # Get market details using slug
            market_url = f'https://gamma-api.polymarket.com/markets/slug/{slug}'
            market_response = requests.get(market_url, timeout=5)
            
            if market_response.status_code == 200:
                market_data = market_response.json()
                
                # Check if tags are already in the market response
                if 'tags' in market_data and market_data['tags']:
                    tags = market_data['tags']
                    if isinstance(tags, list) and len(tags) > 0:
                        # Find first valid sector from all tags
                        valid_sector = self._find_valid_sector_from_tags(tags)
                        cache[slug] = valid_sector  # Cache the result
                        return valid_sector
                
                # If tags not in response, make second call
                market_id = market_data.get('id')
                if market_id:
                    tags_url = f'https://gamma-api.polymarket.com/markets/{market_id}/tags'
                    tags_response = requests.get(tags_url, timeout=5)
                    
                    if tags_response.status_code == 200:
                        tags_data = tags_response.json()
                        if tags_data and isinstance(tags_data, list) and len(tags_data) > 0:
                            # Find first valid sector from all tags
                            valid_sector = self._find_valid_sector_from_tags(tags_data)
                            cache[slug] = valid_sector  # Cache the result
                            return valid_sector
        
        except Exception:
            pass
        
        # Cache 'Other' for failures or missing tags
        cache[slug] = 'Other'
        return 'Other'
    
    def calculate_sector_exposure(self, user: str) -> Dict[str, Any]:
        """
        Calculate portfolio exposure by sector using Gamma API tags.
        Uses caching to minimize API calls.
        """
        # Get all positions
        positions_result = self.get_user_positions(user)
        if 'error' in positions_result:
            return positions_result
        
        positions = positions_result.get('data', [])
        
        # Load cache from file
        label_cache = self._load_cache()
        
        sector_values = defaultdict(float)
        total_value = 0.0
        api_calls_made = 0
        
        # Process positions and categorize by sector
        for position in positions:
            # Get position value - use currentValue from the API response
            value = self._to_float(position.get('currentValue', 0))
            total_value += value
            
            # Get slug and fetch sector label (checks cache first)
            slug = position.get('slug', '')
            
            was_cached = slug in label_cache
            sector = self._get_market_label(slug, label_cache)
            if not was_cached and slug:
                api_calls_made += 1
            
            sector_values[sector] += value
        
        # Save updated cache
        self._save_cache(label_cache)
        
        # Build results
        sorted_sectors = sorted(sector_values.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for sector, value in sorted_sectors:
            percentage = (value / total_value * 100) if total_value > 0 else 0
            results.append({
                'sector': sector,
                'value': round(value, 2),
                'percentage': round(percentage, 2)
            })
        
        return {
            'user': user,
            'sectors': results,
            'totalValue': round(total_value, 2),
            'apiCallsMade': api_calls_made,
            'cachedLabels': len(label_cache)
        }
