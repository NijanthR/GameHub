import os
import json
import time
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Load environment variables
load_dotenv()

app = Flask(__name__)

PORT = int(os.environ.get('PORT', 5000))
GOOGLE_CLIENT_ID = os.environ.get(
    'GOOGLE_CLIENT_ID', 
    '744551691173-9hef8f2pe0kkulqte9m2k9g3migj89aj.apps.googleusercontent.com'
)
JWT_SECRET = os.environ.get('JWT_SECRET', 'gamehub_jwt_fallback_secret_key_2026')
# Configure dynamic allowed origins for local dev & Vercel production
raw_origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]

frontend_env = os.environ.get('FRONTEND_URL')
if frontend_env:
    raw_origins.append(frontend_env.strip())

extra_origins = os.environ.get('ALLOWED_ORIGINS')
if extra_origins:
    raw_origins.extend([o.strip() for o in extra_origins.split(',') if o.strip()])

# Allow localhost, any *.vercel.app domain, and configured domains
ALLOWED_ORIGINS = [
    *raw_origins,
    r"^https:\/\/.*\.vercel\.app$"
]

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Root Health Check for Render
@app.route('/', methods=['GET'])
def root_check():
    return jsonify({
        'status': 'online',
        'service': 'Game Hub API',
        'version': '1.0.0',
        'time': datetime.now(timezone.utc).isoformat()
    }), 200

# In-memory mock database with file persistence for users & stats
DB_FILE = os.path.join(os.path.dirname(__file__), 'users.json')

def load_users():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Could not load {DB_FILE}: {e}")
    return {}

def save_users():
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(users_db, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save {DB_FILE}: {e}")

users_db = load_users()


def generate_jwt(payload: dict, expires_in_days: int = 7) -> str:
    """Helper to generate signed JWT tokens"""
    exp_time = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    token_payload = {
        **payload,
        "exp": int(exp_time.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp())
    }
    return jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")


def authenticate_token(f):
    """Auth decorator to verify JWT Bearer tokens"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Access token required'}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid authorization header format'}), 401

        token = parts[1]
        try:
            decoded_user = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user = decoded_user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 403
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 403

        return f(*args, **kwargs)
    return decorated_function


# ── Health Check ──
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'backend': 'python/flask',
        'time': datetime.now(timezone.utc).isoformat()
    }), 200


# ── Google OAuth Login / Verification ──
@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    try:
        data = request.get_json() or {}
        credential = data.get('credential')
        user_info = data.get('userInfo')

        user_data = None

        if credential:
            # Verify Google ID Token using official google-auth library
            try:
                id_info = id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    GOOGLE_CLIENT_ID
                )
                user_data = {
                    'id': id_info.get('sub'),
                    'email': id_info.get('email'),
                    'name': id_info.get('name'),
                    'picture': id_info.get('picture'),
                    'provider': 'google'
                }
            except Exception as verify_err:
                print(f"[Warning] Google verifyIdToken note: {verify_err}")
                # Fallback if userInfo was already decoded by client
                if user_info:
                    user_data = {**user_info, 'provider': 'google'}
                else:
                    return jsonify({'error': f'Failed to verify Google token: {str(verify_err)}'}), 400
        elif user_info:
            user_data = {**user_info, 'provider': 'google'}
        else:
            return jsonify({'error': 'Missing credential or user info'}), 400

        user_email = user_data.get('email')
        if not user_email:
            return jsonify({'error': 'User email is required'}), 400

        # Save/Update user in in-memory database
        existing = users_db.get(user_email, {
            'gamesPlayed': 0,
            'wins': 0,
            'createdAt': datetime.now(timezone.utc).isoformat()
        })

        user_profile = {
            **existing,
            **user_data,
            'lastLogin': datetime.now(timezone.utc).isoformat()
        }
        users_db[user_email] = user_profile
        save_users()

        # Issue JWT Token (7 days)
        token = generate_jwt(
            {
                'id': user_profile.get('id'),
                'email': user_profile.get('email'),
                'name': user_profile.get('name')
            },
            expires_in_days=7
        )

        return jsonify({
            'success': True,
            'message': 'Google login successful',
            'token': token,
            'user': user_profile
        }), 200

    except Exception as error:
        print(f"[Error] Google auth error: {error}")
        return jsonify({'error': 'Authentication failed', 'details': str(error)}), 500


# ── Guest / Demo Login ──
@app.route('/api/auth/guest', methods=['POST'])
def guest_auth():
    try:
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        timestamp = int(time.time() * 1000)

        guest_name = name if name else f"Player_{int(timestamp % 9000 + 1000)}"
        guest_id = f"guest_{timestamp}"
        guest_email = f"{guest_id}@gamehub.local"

        user_profile = {
            'id': guest_id,
            'name': guest_name,
            'email': guest_email,
            'picture': None,
            'provider': 'guest',
            'gamesPlayed': 0,
            'wins': 0,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'lastLogin': datetime.now(timezone.utc).isoformat()
        }
        users_db[guest_email] = user_profile
        save_users()

        # Issue JWT Token (1 day for guest)
        token = generate_jwt(
            {
                'id': guest_id,
                'email': guest_email,
                'name': guest_name,
                'isGuest': True
            },
            expires_in_days=1
        )

        return jsonify({
            'success': True,
            'message': 'Logged in as guest',
            'token': token,
            'user': user_profile
        }), 200

    except Exception as error:
        print(f"[Error] Guest auth error: {error}")
        return jsonify({'error': 'Guest login failed', 'details': str(error)}), 500


# ── Get Current User Profile ──
@app.route('/api/auth/me', methods=['GET'])
@authenticate_token
def get_current_user():
    user_email = request.user.get('email')
    user = users_db.get(user_email)
    if not user:
        # Reconstruct from token payload if not in database
        user = {
            'id': request.user.get('id', f"user_{int(time.time())}"),
            'name': request.user.get('name', 'Player'),
            'email': user_email,
            'picture': request.user.get('picture', None),
            'provider': 'guest' if request.user.get('isGuest') else 'google',
            'gamesPlayed': 0,
            'wins': 0,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'lastLogin': datetime.now(timezone.utc).isoformat()
        }
        users_db[user_email] = user
        save_users()
    return jsonify({'user': user}), 200


# ── Update Game Stats ──
@app.route('/api/user/stats', methods=['POST'])
@authenticate_token
def update_user_stats():
    user_email = request.user.get('email')
    user = users_db.get(user_email)
    if not user:
        user = {
            'id': request.user.get('id', f"user_{int(time.time())}"),
            'name': request.user.get('name', 'Player'),
            'email': user_email,
            'picture': None,
            'provider': 'guest' if request.user.get('isGuest') else 'google',
            'gamesPlayed': 0,
            'wins': 0,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'lastLogin': datetime.now(timezone.utc).isoformat()
        }

    data = request.get_json() or {}
    won = data.get('won', False)

    user['gamesPlayed'] = user.get('gamesPlayed', 0) + 1
    if won:
        user['wins'] = user.get('wins', 0) + 1

    users_db[user_email] = user
    save_users()
    return jsonify({'success': True, 'user': user}), 200


if __name__ == '__main__':
    print(f"🚀 Game Hub Python Backend running on http://localhost:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
