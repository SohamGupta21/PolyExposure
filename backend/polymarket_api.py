import requests
import json
import argparse
from typing import Optional, Dict, Any


class PolymarketAPI:    
    BASE_URL = "https://data-api.polymarket.com"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'application/json',
            'User-Agent': 'PolyExposure/1.0'
        })
    
    def get_activity(
        self, 
        user: str, 
        limit: int = 500, 
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get activity for a specific wallet address
        
        Args:
            user: Wallet address (e.g., '0x9f47f1fcb1701bf9eaf31236ad39875e5d60af93')
            limit: Maximum number of results to return (default: 500)
            offset: Number of results to skip (default: 0)
        
        Returns:
            Dictionary containing the API response
        """
        url = f"{self.BASE_URL}/activity"
        params = {
            'user': user,
            'limit': limit,
            'offset': offset
        }
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def get_markets(
        self,
        limit: int = 100,
        offset: int = 0,
        active: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Get markets from Polymarket
        
        Args:
            limit: Maximum number of results to return (default: 100)
            offset: Number of results to skip (default: 0)
            active: Filter by active status (optional)
        
        Returns:
            Dictionary containing the API response
        """
        url = f"{self.BASE_URL}/markets"
        params = {
            'limit': limit,
            'offset': offset
        }
        
        if active is not None:
            params['active'] = str(active).lower()
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def get_market(self, market_id: str) -> Dict[str, Any]:
        """
        Get details for a specific market
        
        Args:
            market_id: The market identifier
        
        Returns:
            Dictionary containing the API response
        """
        url = f"{self.BASE_URL}/markets/{market_id}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def get_user_positions(self, user: str) -> Dict[str, Any]:
        """
        Get positions for a specific wallet address
        
        Args:
            user: Wallet address
        
        Returns:
            Dictionary containing the API response
        """
        url = f"{self.BASE_URL}/positions"
        params = {'user': user}
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                'error': str(e),
                'status_code': getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            }
    
    def get_condition(self, condition_id: str) -> Dict[str, Any]:
        """
        Get details for a specific condition
        
        Args:
            condition_id: The condition identifier
        
        Returns:
            Dictionary containing the API response
        """
        # Try conditions endpoint first
        url = f"{self.BASE_URL}/conditions/{condition_id}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # If conditions endpoint fails, try markets endpoint as fallback
            # (condition IDs might be market IDs in some cases)
            try:
                market_url = f"{self.BASE_URL}/markets/{condition_id}"
                response = self.session.get(market_url)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e2:
                return {
                    'error': str(e2),
                    'status_code': getattr(e2.response, 'status_code', None) if hasattr(e2, 'response') else None
                }


def main():
    """Command-line interface for the Polymarket API client"""
    parser = argparse.ArgumentParser(
        description='Interact with the Polymarket Data API'
    )
    parser.add_argument(
        'command',
        choices=['activity', 'markets', 'market', 'positions'],
        help='API command to execute'
    )
    # Positional arguments for convenience (used when flags are not provided)
    parser.add_argument(
        'positional_args',
        nargs='*',
        help='Positional arguments: for activity/positions: [user] [limit] [offset]; for market: [market_id]'
    )
    parser.add_argument(
        '--user',
        type=str,
        help='Wallet address (required for activity and positions)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=500,
        help='Maximum number of results (default: 500)'
    )
    parser.add_argument(
        '--offset',
        type=int,
        default=0,
        help='Number of results to skip (default: 0)'
    )
    parser.add_argument(
        '--market-id',
        type=str,
        help='Market ID (required for market command)'
    )
    parser.add_argument(
        '--active',
        type=bool,
        help='Filter markets by active status'
    )
    parser.add_argument(
        '--output',
        type=str,
        help='Output file path (optional, prints to stdout if not specified)'
    )
    
    args = parser.parse_args()
    
    # Parse positional arguments based on command
    if args.positional_args:
        if args.command in ['activity', 'positions']:
            if len(args.positional_args) >= 1 and not args.user:
                args.user = args.positional_args[0]
            if len(args.positional_args) >= 2 and args.limit == 500:  # Only override if default
                try:
                    args.limit = int(args.positional_args[1])
                except ValueError:
                    pass
            if len(args.positional_args) >= 3 and args.offset == 0:  # Only override if default
                try:
                    args.offset = int(args.positional_args[2])
                except ValueError:
                    pass
        elif args.command == 'market':
            if len(args.positional_args) >= 1 and not args.market_id:
                args.market_id = args.positional_args[0]
    
    api = PolymarketAPI()
    result = None
    
    if args.command == 'activity':
        if not args.user:
            print("Error: --user is required for activity command")
            return
        result = api.get_activity(args.user, args.limit, args.offset)
    
    elif args.command == 'markets':
        result = api.get_markets(args.limit, args.offset, args.active)
    
    elif args.command == 'market':
        if not args.market_id:
            print("Error: --market-id is required for market command")
            return
        result = api.get_market(args.market_id)
    
    elif args.command == 'positions':
        if not args.user:
            print("Error: --user is required for positions command")
            return
        result = api.get_user_positions(args.user)
    
    # Output results
    output = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Results saved to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()

