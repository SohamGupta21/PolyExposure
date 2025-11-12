import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)
TEST_USER = "0x1234567890123456789012345678901234567890"


class TestPNLAPI:
    
    def test_pnl_endpoint_success(self):
        mock_pnl_result = {
            'user': TEST_USER,
            'data': [{'date': '2024-01', 'pnl': 100.0, 'cumulativePnL': 100.0}, {'date': '2024-02', 'pnl': -50.0, 'cumulativePnL': 50.0}],
            'totalPnL': 50.0
        }
        
        with patch('main.polymarket_api.calculate_pnl_history', return_value=mock_pnl_result):
            response = client.get(f"/api/pnl?user={TEST_USER}")
        
        assert response.status_code == 200
        data = response.json()
        assert data['user'] == TEST_USER
        assert len(data['data']) == 2
        assert data['data'][0]['date'] == '2024-01'
        assert data['data'][0]['pnl'] == 100.0
        assert data['totalPnL'] == 50.0
    
    def test_pnl_endpoint_missing_user(self):
        assert client.get("/api/pnl").status_code == 422
    
    def test_pnl_endpoint_api_error(self):
        with patch('main.polymarket_api.calculate_pnl_history', return_value={'error': 'API error', 'status_code': 500}):
            response = client.get(f"/api/pnl?user={TEST_USER}")
        
        assert response.status_code == 500
        assert 'detail' in response.json()
    
    def test_pnl_endpoint_empty_result(self):
        with patch('main.polymarket_api.calculate_pnl_history', return_value={'user': TEST_USER, 'data': [], 'totalPnL': 0.0}):
            response = client.get(f"/api/pnl?user={TEST_USER}")
        
        assert response.status_code == 200
        data = response.json()
        assert data['user'] == TEST_USER
        assert len(data['data']) == 0
        assert data['totalPnL'] == 0.0
    
    def test_pnl_endpoint_exception_handling(self):
        with patch('main.polymarket_api.calculate_pnl_history', side_effect=Exception("Unexpected error")):
            response = client.get(f"/api/pnl?user={TEST_USER}")
        
        assert response.status_code == 500
        assert 'detail' in response.json()
    
    def test_pnl_endpoint_response_format(self):
        mock_pnl_result = {
            'user': TEST_USER,
            'data': [{'date': '2024-01', 'pnl': 150.75, 'cumulativePnL': 150.75}],
            'totalPnL': 150.75
        }
        
        with patch('main.polymarket_api.calculate_pnl_history', return_value=mock_pnl_result):
            response = client.get(f"/api/pnl?user={TEST_USER}")
        
        assert response.status_code == 200
        data = response.json()
        assert 'user' in data and 'data' in data and 'totalPnL' in data
        assert isinstance(data['data'], list)
        if len(data['data']) > 0:
            assert all(k in data['data'][0] for k in ['date', 'pnl', 'cumulativePnL'])


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
