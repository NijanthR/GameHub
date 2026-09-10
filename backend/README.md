# Game Hub Backend (Python)

This is the Python backend service for Game Hub, providing authentication (Google OAuth token verification, guest logins), JWT session management, user profile access, and statistics tracking.

## Requirements
- Python 3.10+
- Installed packages from `requirements.txt`:
  ```bash
  pip install -r requirements.txt
  ```

## Running the Backend

Start the server:
```bash
python server.py
```
The server will start on `http://localhost:5000` (or the port defined in `.env`).

## Running Tests
```bash
python test_server.py
```

## API Endpoints

- **Health Check**: `GET /api/health`
- **Google OAuth Login**: `POST /api/auth/google`
  - Body: `{ "credential": "<Google ID Token>", "userInfo": { ... } }`
- **Guest Login**: `POST /api/auth/guest`
  - Body: `{ "name": "GuestName" }`
- **Current User Profile**: `GET /api/auth/me` (requires Bearer token)
- **Update Game Stats**: `POST /api/user/stats` (requires Bearer token)
  - Body: `{ "won": true }`
