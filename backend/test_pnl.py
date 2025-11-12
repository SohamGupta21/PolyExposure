import unittest
from unittest.mock import patch
from polymarket_api import PolymarketAPI
from datetime import datetime


class TestPNLCalculation(unittest.TestCase):
    
    def setUp(self):
        self.api = PolymarketAPI()
        self.test_user = "0x1234567890123456789012345678901234567890"
    
    def test_simple_buy_sell_scenario(self):
        activity_data = [
            {'conditionId': 'cond1', 'side': 'BUY', 'size': 10.0, 'price': 0.50, 'timestamp': int(datetime(2024, 1, 15).timestamp())},
            {'conditionId': 'cond1', 'side': 'SELL', 'size': 10.0, 'price': 0.60, 'timestamp': int(datetime(2024, 1, 20).timestamp())}
        ]
        
        with patch.object(self.api, 'get_closed_positions', return_value=activity_data), \
             patch.object(self.api, 'get_user_positions', return_value=[]):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        self.assertEqual(result['user'], self.test_user)
        self.assertEqual(len(result['data']), 1)
        self.assertEqual(result['data'][0]['date'], '2024-01')
        self.assertAlmostEqual(result['data'][0]['pnl'], 100.0, places=2)
        self.assertAlmostEqual(result['data'][0]['cumulativePnL'], 100.0, places=2)
        self.assertAlmostEqual(result['totalPnL'], 100.0, places=2)
    
    def test_unrealized_pnl_from_positions(self):
        positions_data = [{'conditionId': 'cond1', 'size': 10.0, 'avgPrice': 0.50, 'curPrice': 0.60}]
        
        with patch.object(self.api, 'get_closed_positions', return_value=[]), \
             patch.object(self.api, 'get_user_positions', return_value=positions_data):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        current_month = datetime.now().strftime('%Y-%m')
        month_data = next((d for d in result['data'] if d['date'] == current_month), None)
        self.assertIsNotNone(month_data)
        self.assertAlmostEqual(month_data['pnl'], 100.0, places=2)
    
    def test_monthly_grouping(self):
        activity_data = [
            {'conditionId': 'cond1', 'side': 'BUY', 'size': 10.0, 'price': 0.50, 'timestamp': int(datetime(2024, 1, 15).timestamp())},
            {'conditionId': 'cond1', 'side': 'SELL', 'size': 10.0, 'price': 0.60, 'timestamp': int(datetime(2024, 1, 20).timestamp())},
            {'conditionId': 'cond2', 'side': 'BUY', 'size': 5.0, 'price': 0.40, 'timestamp': int(datetime(2024, 2, 10).timestamp())},
            {'conditionId': 'cond2', 'side': 'SELL', 'size': 5.0, 'price': 0.50, 'timestamp': int(datetime(2024, 2, 15).timestamp())}
        ]
        
        with patch.object(self.api, 'get_closed_positions', return_value=activity_data), \
             patch.object(self.api, 'get_user_positions', return_value=[]):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        self.assertEqual(len(result['data']), 2)
        self.assertEqual(result['data'][0]['date'], '2024-01')
        self.assertEqual(result['data'][1]['date'], '2024-02')
        self.assertAlmostEqual(result['data'][0]['cumulativePnL'], 100.0, places=2)
        self.assertAlmostEqual(result['data'][1]['cumulativePnL'], 150.0, places=2)
    
    def test_cumulative_pnl_tracking(self):
        activity_data = [
            {'conditionId': 'cond1', 'side': 'BUY', 'size': 10.0, 'price': 0.50, 'timestamp': int(datetime(2024, 1, 10).timestamp())},
            {'conditionId': 'cond1', 'side': 'SELL', 'size': 10.0, 'price': 0.60, 'timestamp': int(datetime(2024, 1, 15).timestamp())},
            {'conditionId': 'cond2', 'side': 'BUY', 'size': 5.0, 'price': 0.40, 'timestamp': int(datetime(2024, 2, 10).timestamp())},
            {'conditionId': 'cond2', 'side': 'SELL', 'size': 5.0, 'price': 0.30, 'timestamp': int(datetime(2024, 2, 15).timestamp())}
        ]
        
        with patch.object(self.api, 'get_closed_positions', return_value=activity_data), \
             patch.object(self.api, 'get_user_positions', return_value=[]):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        self.assertAlmostEqual(result['data'][0]['cumulativePnL'], 100.0, places=2)
        self.assertAlmostEqual(result['data'][1]['cumulativePnL'], 50.0, places=2)
        self.assertAlmostEqual(result['totalPnL'], 50.0, places=2)
    
    def test_empty_activity_no_positions(self):
        with patch.object(self.api, 'get_closed_positions', return_value=[]), \
             patch.object(self.api, 'get_user_positions', return_value=[]):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        self.assertEqual(result['user'], self.test_user)
        self.assertEqual(len(result['data']), 0)
        self.assertAlmostEqual(result['totalPnL'], 0.0, places=2)
    
    def test_api_error_handling(self):
        with patch.object(self.api, 'get_closed_positions', return_value={'error': 'API error', 'status_code': 500}):
            result = self.api.calculate_pnl_history(self.test_user)
        
        self.assertIn('error', result)
    
    def test_loss_scenario(self):
        activity_data = [
            {'conditionId': 'cond1', 'side': 'BUY', 'size': 10.0, 'price': 0.60, 'timestamp': int(datetime(2024, 1, 10).timestamp())},
            {'conditionId': 'cond1', 'side': 'SELL', 'size': 10.0, 'price': 0.40, 'timestamp': int(datetime(2024, 1, 20).timestamp())}
        ]
        
        with patch.object(self.api, 'get_closed_positions', return_value=activity_data), \
             patch.object(self.api, 'get_user_positions', return_value=[]):
            result = self.api.calculate_pnl_history(self.test_user, 'monthly')
        
        self.assertAlmostEqual(result['data'][0]['pnl'], -200.0, places=2)
        self.assertAlmostEqual(result['totalPnL'], -200.0, places=2)


if __name__ == '__main__':
    unittest.main()
