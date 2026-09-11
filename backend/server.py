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
        "allow_headers": ["Content-Type", "Authorization", "X-Admin-Key", "x-admin-key", "Accept", "Origin", "X-Requested-With"],
        "expose_headers": ["*"],
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
ACTIVITIES_FILE = os.path.join(os.path.dirname(__file__), 'activities.json')

ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'gamehub-admin-2026')
ADMIN_EMAILS = [
    'srinijan2405@gmail.com',
    'srinijan12405@gmail.com',
    'nijanth.al23@bitsathy.ac.in'
]

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


def load_activities():
    if os.path.exists(ACTIVITIES_FILE):
        try:
            with open(ACTIVITIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Could not load {ACTIVITIES_FILE}: {e}")
    return []

def save_activities():
    try:
        # Keep recent 3000 events to maintain ultra-fast performance
        trimmed = activities_db[-3000:]
        with open(ACTIVITIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(trimmed, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save {ACTIVITIES_FILE}: {e}")

activities_db = load_activities()

# Online session registry: { email: { timestamp, name, game, ip, device } }
online_sessions = {}

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr or '127.0.0.1'

def get_client_device():
    ua = request.headers.get('User-Agent', '')
    if 'Mobile' in ua or 'Android' in ua or 'iPhone' in ua:
        return 'Mobile Device'
    if 'Windows' in ua:
        return 'Windows PC'
    if 'Macintosh' in ua:
        return 'Mac OS'
    if 'Linux' in ua:
        return 'Linux'
    return 'Web Browser'

def record_activity_event(action, user_data=None, game=None, details=None, duration=0, score=None, outcome=None, extra=None):
    """Central logging helper for all platform events"""
    now_iso = datetime.now(timezone.utc).isoformat()
    user_email = (user_data or {}).get('email', 'anonymous@gamehub.local')
    user_name = (user_data or {}).get('name', 'Anonymous Player')
    user_picture = (user_data or {}).get('picture', None)
    provider = (user_data or {}).get('provider', 'guest')

    event = {
        'id': f"act_{int(time.time() * 1000)}_{len(activities_db) + 1}",
        'timestamp': now_iso,
        'action': action, # 'LOGIN' | 'LOGOUT' | 'GAME_START' | 'GAME_COMPLETE' | 'AI_HINT' | 'PAGE_VIEW'
        'userEmail': user_email,
        'userName': user_name,
        'userPicture': user_picture,
        'provider': provider,
        'game': game,
        'details': details or '',
        'durationSeconds': int(duration or 0),
        'score': score,
        'outcome': outcome, # 'WIN' | 'LOSS' | 'DRAW' | 'FINISHED' | None
        'ip': get_client_ip(),
        'device': get_client_device(),
        'extra': extra or {}
    }

    activities_db.append(event)
    save_activities()

    # Update online heartbeat session
    online_sessions[user_email] = {
        'timestamp': time.time(),
        'lastActive': now_iso,
        'name': user_name,
        'picture': user_picture,
        'email': user_email,
        'provider': provider,
        'currentGame': game if action in ['GAME_START', 'AI_HINT'] else None,
        'ip': event['ip'],
        'device': event['device']
    }

    return event


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


def is_authorized_admin():
    """Verify admin privilege from header PIN, JWT or query param"""
    # 1. Direct Secret key matching from header or query param
    admin_key = (
        request.headers.get('X-Admin-Key') or 
        request.headers.get('x-admin-key') or 
        request.args.get('adminKey') or
        request.args.get('pin')
    )
    if admin_key and admin_key.strip() == ADMIN_SECRET:
        return True

    # 2. Authorization Header check
    auth_header = request.headers.get('Authorization')
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            token = parts[1]
            if token == ADMIN_SECRET or token == 'admin_verified':
                return True
            
            # Try decoding backend-issued HS256 JWT
            try:
                decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                if decoded.get('email') in ADMIN_EMAILS or decoded.get('role') == 'admin':
                    return True
            except Exception:
                pass

            # Try decoding unverified payload (Google ID Token RS256 or custom token)
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                if unverified.get('email') in ADMIN_EMAILS or unverified.get('role') == 'admin':
                    return True
            except Exception:
                pass

    return False


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
            'loginCount': 0,
            'createdAt': datetime.now(timezone.utc).isoformat()
        })

        user_profile = {
            **existing,
            **user_data,
            'loginCount': existing.get('loginCount', 0) + 1,
            'lastLogin': datetime.now(timezone.utc).isoformat(),
            'lastIp': get_client_ip(),
            'lastDevice': get_client_device()
        }
        users_db[user_email] = user_profile
        save_users()

        # Log Activity Event
        record_activity_event(
            action='LOGIN',
            user_data=user_profile,
            details=f"Google sign-in from {get_client_device()}"
        )

        # Issue JWT Token (7 days)
        token = generate_jwt(
            {
                'id': user_profile.get('id'),
                'email': user_profile.get('email'),
                'name': user_profile.get('name'),
                'picture': user_profile.get('picture')
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
            'loginCount': 1,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'lastLogin': datetime.now(timezone.utc).isoformat(),
            'lastIp': get_client_ip(),
            'lastDevice': get_client_device()
        }
        users_db[guest_email] = user_profile
        save_users()

        # Log Activity Event
        record_activity_event(
            action='LOGIN',
            user_data=user_profile,
            details=f"Guest sign-in ({guest_name})"
        )

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


# ── Telemetry: Ingest Real-Time User Activities ──
@app.route('/api/activity/log', methods=['POST'])
def log_activity_api():
    try:
        data = request.get_json() or {}
        action = data.get('action', 'PAGE_VIEW')
        user_data = data.get('user') or {}
        game = data.get('game')
        details = data.get('details', '')
        duration = data.get('durationSeconds', 0)
        score = data.get('score')
        outcome = data.get('outcome')
        extra = data.get('extra', {})

        event = record_activity_event(
            action=action,
            user_data=user_data,
            game=game,
            details=details,
            duration=duration,
            score=score,
            outcome=outcome,
            extra=extra
        )

        # Update user profile in database
        user_email = user_data.get('email')
        if user_email:
            now_iso = datetime.now(timezone.utc).isoformat()
            if user_email not in users_db:
                users_db[user_email] = {
                    'id': user_data.get('id', f"user_{int(time.time())}"),
                    'name': user_data.get('name', 'Player'),
                    'email': user_email,
                    'picture': user_data.get('picture'),
                    'provider': user_data.get('provider', 'guest'),
                    'gamesPlayed': 1 if action == 'GAME_COMPLETE' else 0,
                    'wins': 1 if action == 'GAME_COMPLETE' and outcome == 'WIN' else 0,
                    'loginCount': 1 if action == 'LOGIN' else 0,
                    'createdAt': now_iso,
                    'lastLogin': now_iso if action == 'LOGIN' else None,
                    'lastActive': now_iso,
                    'lastIp': get_client_ip(),
                    'lastDevice': get_client_device()
                }
            else:
                u = users_db[user_email]
                if user_data.get('name'):
                    u['name'] = user_data['name']
                if user_data.get('picture'):
                    u['picture'] = user_data['picture']
                if action == 'LOGIN':
                    u['loginCount'] = u.get('loginCount', 0) + 1
                    u['lastLogin'] = now_iso
                elif action == 'GAME_COMPLETE':
                    u['gamesPlayed'] = u.get('gamesPlayed', 0) + 1
                    if outcome == 'WIN':
                        u['wins'] = u.get('wins', 0) + 1
                u['lastActive'] = now_iso
                u['lastIp'] = get_client_ip()
                u['lastDevice'] = get_client_device()
            save_users()

        return jsonify({'success': True, 'eventId': event['id']}), 200

    except Exception as e:
        print(f"[Error] /api/activity/log: {e}")
        return jsonify({'error': str(e)}), 500


# ── Telemetry: Heartbeat Keep-Alive ──
@app.route('/api/activity/heartbeat', methods=['POST'])
def activity_heartbeat():
    data = request.get_json() or {}
    email = data.get('email')
    name = data.get('name', 'Player')
    game = data.get('game')

    if email:
        online_sessions[email] = {
            'timestamp': time.time(),
            'lastActive': datetime.now(timezone.utc).isoformat(),
            'name': name,
            'email': email,
            'provider': data.get('provider', 'guest'),
            'currentGame': game,
            'ip': get_client_ip(),
            'device': get_client_device()
        }

    # Clean sessions older than 5 minutes
    cutoff = time.time() - 300
    active_now = [s for s in online_sessions.values() if s['timestamp'] > cutoff]

    return jsonify({'success': True, 'activeCount': len(active_now)}), 200


# ── Admin Auth Verification ──
@app.route('/api/admin/verify', methods=['POST'])
def admin_verify():
    data = request.get_json() or {}
    pin = data.get('pin', '').strip()
    email = data.get('email', '').strip()

    if pin == ADMIN_SECRET or email in ADMIN_EMAILS:
        token = generate_jwt({'role': 'admin', 'email': email or 'admin@gamehub.local'}, expires_in_days=1)
        return jsonify({
            'valid': True,
            'message': 'Admin access granted',
            'token': token
        }), 200

    return jsonify({'valid': False, 'error': 'Invalid admin master passcode'}), 401


# ── Admin: Comprehensive Platform Metrics ──
@app.route('/api/admin/metrics', methods=['GET'])
def admin_metrics():
    if not is_authorized_admin():
        return jsonify({'error': 'Unauthorized admin access'}), 403

    now = time.time()
    cutoff_active = now - 300 # 5 minutes

    # Active users right now
    active_users = [
        s for s in online_sessions.values()
        if s.get('timestamp', 0) > cutoff_active
    ]

    total_users = len(users_db)
    google_users = sum(1 for u in users_db.values() if u.get('provider') == 'google')
    guest_users = total_users - google_users

    # Game usage breakdowns
    game_counts = {
        'Water Sort': 0,
        'Sudoku': 0,
        'Chess': 0,
        'Floppy Bird': 0,
        '2048': 0,
        'Color Flow': 0,
        'Tic Tac Toe': 0
    }

    game_wins = {k: 0 for k in game_counts}
    total_playtime_sec = 0
    total_games_played = 0
    ai_hints_used = 0
    logins_count = 0

    # Hourly activity distribution for past 24 hours
    hourly_trend = {f"{h:02d}:00": 0 for h in range(24)}

    for act in activities_db:
        action = act.get('action')
        game = act.get('game')
        duration = act.get('durationSeconds', 0)
        outcome = act.get('outcome')

        total_playtime_sec += duration

        if action == 'LOGIN':
            logins_count += 1
        elif action == 'AI_HINT':
            ai_hints_used += 1
        elif action in ['GAME_COMPLETE', 'GAME_START']:
            if action == 'GAME_COMPLETE':
                total_games_played += 1
                if outcome == 'WIN' and game in game_wins:
                    game_wins[game] += 1

            if game and game in game_counts:
                game_counts[game] += 1
            elif game:
                # normalize name
                for standard_name in game_counts:
                    if standard_name.lower() in game.lower():
                        game_counts[standard_name] += 1
                        break

        # Hourly bucket
        try:
            ts = datetime.fromisoformat(act.get('timestamp').replace('Z', '+00:00'))
            hour_str = f"{ts.hour:02d}:00"
            if hour_str in hourly_trend:
                hourly_trend[hour_str] += 1
        except Exception:
            pass

    # Top game
    top_game = max(game_counts.items(), key=lambda x: x[1]) if any(game_counts.values()) else ('Water Sort', 0)

    # Calculate overall win rate
    total_wins = sum(game_wins.values())
    overall_win_rate = round((total_wins / total_games_played * 100), 1) if total_games_played > 0 else 0

    return jsonify({
        'overview': {
            'totalUsers': total_users,
            'googleUsers': google_users,
            'guestUsers': guest_users,
            'activeNow': len(active_users),
            'totalGamesPlayed': max(total_games_played, sum(u.get('gamesPlayed', 0) for u in users_db.values())),
            'totalPlaytimeMinutes': round(total_playtime_sec / 60, 1),
            'totalLogins': logins_count,
            'aiHintsUsed': ai_hints_used,
            'overallWinRate': overall_win_rate,
            'topGame': {
                'name': top_game[0],
                'count': top_game[1]
            }
        },
        'gameBreakdown': game_counts,
        'gameWins': game_wins,
        'hourlyTrend': hourly_trend,
        'activeUsersList': active_users
    }), 200


# ── Admin: Detailed User Directory ──
@app.route('/api/admin/users', methods=['GET'])
def admin_users_list():
    if not is_authorized_admin():
        return jsonify({'error': 'Unauthorized admin access'}), 403

    now = time.time()
    cutoff_active = now - 300

    enriched = []
    for email, u in users_db.items():
        session = online_sessions.get(email, {})
        is_online = session.get('timestamp', 0) > cutoff_active

        # Count activities for this user
        user_acts = [a for a in activities_db if a.get('userEmail') == email]
        logins = sum(1 for a in user_acts if a.get('action') == 'LOGIN') or u.get('loginCount', 1)
        games_played = u.get('gamesPlayed', sum(1 for a in user_acts if a.get('action') == 'GAME_COMPLETE'))
        wins = u.get('wins', sum(1 for a in user_acts if a.get('outcome') == 'WIN'))

        # Find favorite game
        played_games = [a.get('game') for a in user_acts if a.get('game')]
        fav_game = max(set(played_games), key=played_games.count) if played_games else 'None'

        enriched.append({
            'id': u.get('id'),
            'name': u.get('name', 'Player'),
            'email': email,
            'picture': u.get('picture'),
            'provider': u.get('provider', 'guest'),
            'createdAt': u.get('createdAt'),
            'lastLogin': u.get('lastLogin'),
            'lastActive': session.get('lastActive') or u.get('lastLogin'),
            'isOnline': is_online,
            'currentGame': session.get('currentGame'),
            'loginCount': logins,
            'gamesPlayed': games_played,
            'wins': wins,
            'winRate': round((wins / games_played * 100), 1) if games_played > 0 else 0,
            'favoriteGame': fav_game,
            'lastIp': u.get('lastIp') or session.get('ip') or '127.0.0.1',
            'lastDevice': u.get('lastDevice') or session.get('device') or 'Browser'
        })

    # Sort: online first, then by lastLogin descending
    enriched.sort(key=lambda x: (not x['isOnline'], x['lastLogin'] or ''), reverse=True)

    return jsonify({'users': enriched, 'total': len(enriched)}), 200


# ── Admin: Activity Stream / Event Log ──
@app.route('/api/admin/activities', methods=['GET', 'DELETE'])
def admin_activities():
    if not is_authorized_admin():
        return jsonify({'error': 'Unauthorized admin access'}), 403

    if request.method == 'DELETE':
        activities_db.clear()
        save_activities()
        return jsonify({'success': True, 'message': 'All activity logs cleared'}), 200

    # Query filters
    limit = int(request.args.get('limit', 150))
    action_filter = request.args.get('action')
    game_filter = request.args.get('game')
    search = request.args.get('search', '').lower().strip()
    user_filter = request.args.get('user', '').lower().strip()

    filtered = activities_db[::-1] # Newest first

    if action_filter and action_filter != 'ALL':
        filtered = [a for a in filtered if a.get('action') == action_filter]

    if game_filter and game_filter != 'ALL':
        filtered = [a for a in filtered if a.get('game') == game_filter]

    if user_filter:
        filtered = [a for a in filtered if user_filter in (a.get('userEmail') or '').lower()]

    if search:
        filtered = [
            a for a in filtered
            if search in (a.get('userName') or '').lower()
            or search in (a.get('userEmail') or '').lower()
            or search in (a.get('details') or '').lower()
            or search in (a.get('game') or '').lower()
        ]

    total_count = len(filtered)
    paginated = filtered[:limit]

    return jsonify({
        'activities': paginated,
        'total': total_count,
        'returned': len(paginated)
    }), 200


# ── Admin: Export Data ──
@app.route('/api/admin/export', methods=['GET'])
def admin_export():
    if not is_authorized_admin():
        return jsonify({'error': 'Unauthorized admin access'}), 403

    export_format = request.args.get('format', 'json').lower()

    if export_format == 'csv':
        import io
        import csv
        from flask import Response

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Event ID', 'Timestamp (UTC)', 'Action', 'User Name', 'Email',
            'Provider', 'Game', 'Outcome', 'Score', 'Duration (Sec)', 'Details', 'IP', 'Device'
        ])

        for a in activities_db:
            writer.writerow([
                a.get('id'),
                a.get('timestamp'),
                a.get('action'),
                a.get('userName'),
                a.get('userEmail'),
                a.get('provider'),
                a.get('game') or '',
                a.get('outcome') or '',
                a.get('score') or '',
                a.get('durationSeconds', 0),
                a.get('details') or '',
                a.get('ip') or '',
                a.get('device') or ''
            ])

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f"attachment;filename=gamehub_activity_export_{int(time.time())}.csv"}
        )

    return jsonify({
        'exportedAt': datetime.now(timezone.utc).isoformat(),
        'totalUsers': len(users_db),
        'totalActivities': len(activities_db),
        'users': list(users_db.values()),
        'activities': activities_db
    }), 200


# ── Get Current User Profile ──
@app.route('/api/auth/me', methods=['GET'])
@authenticate_token
def get_current_user():
    user_email = request.user.get('email')
    user = users_db.get(user_email)
    if not user:
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

