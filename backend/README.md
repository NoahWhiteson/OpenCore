# OpenCore Backend API

Secure encrypted API for system statistics with authentication.

## Features

- JWT-based authentication
- AES-256-GCM encryption for all responses
- System stats collection (CPU, memory, disk, network, processes)
- Rate limiting and security headers
- Express.js REST API

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Generate environment file with secrets:
```bash
node setup-env.js
```

This creates a `.env` file with:
- `JWT_SECRET`: Secret for JWT token signing
- `ENCRYPTION_KEY`: 32-byte hex key for AES-256-GCM encryption
- `ADMIN_USERNAME`: Admin username (default: admin)
- `ADMIN_PASSWORD`: Admin password (default: admin123)

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

4. Test all APIs:
```bash
node test-api.js
```

## API Endpoints

### Authentication

**POST /api/auth/login**
- Body: `{ "username": "admin", "password": "admin123" }`
- Returns: JWT token

**GET /api/auth/verify**
- Headers: `Authorization: Bearer <token>`
- Returns: Token validation status

### System Stats (All require authentication)

**GET /api/stats/system**
- Returns: Complete system information (encrypted)

**GET /api/stats/cpu**
- Returns: CPU info, load, and temperature (encrypted)

**GET /api/stats/memory**
- Returns: Memory usage statistics (encrypted)

**GET /api/stats/network**
- Returns: Network interfaces and statistics (encrypted)

**GET /api/stats/storage**
- Returns: Storage devices and filesystem info (encrypted)

**GET /api/stats/processes**
- Returns: Running processes list (encrypted)

**GET /api/stats/applications**
- Returns: Comprehensive running applications data with all details (encrypted)
- Includes: PID, name, path, command, CPU, memory, threads, handles, user, runtime, and more

**GET /api/stats/applications/:pid**
- Returns: Detailed information for a specific application by PID (encrypted)

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- JWT token authentication
- AES-256-GCM encryption for all data
- Error handling with safe error messages

## Response Format

All stats endpoints return encrypted data:
```json
{
  "data": {
    "encrypted": "...",
    "iv": "...",
    "authTag": "..."
  }
}
```

Use the decryption function with the `ENCRYPTION_KEY` from `.env` to decrypt responses.

## Environment Variables

- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret for JWT tokens (required)
- `JWT_EXPIRES_IN`: Token expiration time (default: 24h)
- `ADMIN_USERNAME`: Admin username (default: admin)
- `ADMIN_PASSWORD`: Admin password (default: admin123)
- `ENCRYPTION_KEY`: 64-character hex string for encryption (required for decryption)
- `NODE_ENV`: Environment (development/production)
