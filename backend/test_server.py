import unittest
import json
from server import app, users_db

class TestBackendAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_health(self):
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['backend'], 'python/flask')

    def test_guest_login_and_me(self):
        # 1. Guest login
        guest_res = self.app.post('/api/auth/guest', json={'name': 'PythonHero'})
        self.assertEqual(guest_res.status_code, 200)
        guest_data = json.loads(guest_res.data)
        self.assertTrue(guest_data['success'])
        self.assertEqual(guest_data['user']['name'], 'PythonHero')
        self.assertIn('token', guest_data)

        token = guest_data['token']

        # 2. Get profile /api/auth/me
        me_res = self.app.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
        self.assertEqual(me_res.status_code, 200)
        me_data = json.loads(me_res.data)
        self.assertEqual(me_data['user']['name'], 'PythonHero')

        # 3. Update stats /api/user/stats
        stats_res = self.app.post(
            '/api/user/stats',
            headers={'Authorization': f'Bearer {token}'},
            json={'won': True}
        )
        self.assertEqual(stats_res.status_code, 200)
        stats_data = json.loads(stats_res.data)
        self.assertEqual(stats_data['user']['gamesPlayed'], 1)
        self.assertEqual(stats_data['user']['wins'], 1)

    def test_google_auth_with_userinfo(self):
        google_res = self.app.post('/api/auth/google', json={
            'userInfo': {
                'id': 'google_12345',
                'email': 'player@gmail.com',
                'name': 'Test Player',
                'picture': 'https://example.com/pic.jpg'
            }
        })
        self.assertEqual(google_res.status_code, 200)
        data = json.loads(google_res.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['user']['email'], 'player@gmail.com')
        self.assertIn('token', data)

if __name__ == '__main__':
    unittest.main()
