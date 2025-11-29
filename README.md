# OpenCore

<div align="center">
  <img src="./frontend/public/OpenCoreBanner.png" alt="OpenCore Banner" width="600"/>
</div>

A secure, encrypted system monitoring and management platform with real-time terminal access, comprehensive analytics, and multi-server support.

## Features

- **Real-time System Monitoring**: CPU, Memory, Storage, and Network metrics
- **Secure Terminal Access**: Web-based terminal with persistent sessions
- **Multi-Server Management**: Monitor and manage multiple servers from a central hub
- **Comprehensive Analytics**: Historical data tracking and detailed reports
- **Encrypted API**: All data is encrypted in transit
- **Modern UI**: Beautiful, responsive interface with dark/light theme support

## Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **OpenSSL** (for generating secure keys on Linux/Mac)

## Installation

### Quick Install

We provide automated installation scripts for both Linux/Mac and Windows:

#### Linux/Mac

```bash
chmod +x install/install.sh
./install/install.sh
```

#### Windows

```powershell
.\install\install.ps1
```

The installation script will:
1. Clone the repository from GitHub
2. Prompt you for configuration:
   - Admin username and password
   - Backend port (default: 3000)
   - Frontend port (default: 3001)
   - Public IP address
3. Generate secure JWT and encryption keys
4. Install all dependencies
5. Build the frontend
6. Create all necessary configuration files

### Manual Installation

If you prefer to install manually:

1. **Clone the repository**
   ```bash
   git clone https://github.com/NoahWhiteson/OpenCore.git
   cd OpenCore
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   ```

3. **Create backend `.env` file**
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_KEY=your_encryption_key_here
   PORT=3000
   NODE_ENV=production
   ALLOWED_ORIGINS=http://your-ip:3001,http://localhost:3001
   ```

   Generate secrets:
   ```bash
   # JWT Secret
   openssl rand -hex 32
   
   # Encryption Key
   openssl rand -hex 32
   ```

4. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

5. **Create frontend `.env.local` file**
   ```env
   NEXT_PUBLIC_API_URL=http://your-ip:3000
   ```

6. **Build Frontend**
   ```bash
   npm run build
   ```

## Running OpenCore

### Using Start Scripts

#### Linux/Mac
```bash
# Terminal 1 - Backend
./install/start-backend.sh

# Terminal 2 - Frontend
./install/start-frontend.sh
```

#### Windows
```powershell
# Terminal 1 - Backend
.\install\start-backend.ps1

# Terminal 2 - Frontend
.\install\start-frontend.ps1
```

### Manual Start

#### Backend
```bash
cd backend
npm start
```

#### Frontend
```bash
cd frontend
npm start
```

## Accessing OpenCore

Once both servers are running:

- **Frontend**: `http://your-ip:3001` or `http://localhost:3001`
- **Backend API**: `http://your-ip:3000` or `http://localhost:3000`

Login with the admin credentials you configured during installation.

## Configuration

### Environment Variables

#### Backend (`.env`)
- `ADMIN_USERNAME` - Admin login username
- `ADMIN_PASSWORD` - Admin login password
- `JWT_SECRET` - Secret key for JWT tokens (generate with `openssl rand -hex 32`)
- `ENCRYPTION_KEY` - Key for API response encryption (generate with `openssl rand -hex 32`)
- `PORT` - Backend server port (default: 3000)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

#### Frontend (`.env.local`)
- `NEXT_PUBLIC_API_URL` - Backend API URL (e.g., `http://your-ip:3000`)

### Port Configuration

By default:
- **Backend**: Port 3000
- **Frontend**: Port 3001

You can change these in the installation script or by modifying the `.env` files directly.

## Features Overview

### System Monitoring
- Real-time CPU, Memory, and Storage usage
- Network interface statistics
- Historical data tracking (hourly snapshots)
- Export detailed PDF reports

### Terminal Access
- Web-based terminal emulator
- Persistent terminal sessions
- Startup command configuration
- Multiple terminal sessions per server

### Multi-Server Support
- Add and manage multiple servers
- Centralized monitoring dashboard
- Per-server analytics and logs

### Security
- JWT-based authentication
- AES-256-GCM encrypted API responses
- Secure WebSocket connections
- Rate limiting and CORS protection

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses node --watch for auto-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Next.js development server
```

## Project Structure

```
OpenCore/
├── backend/           # Node.js/Express API server
│   ├── database/     # SQLite database and migrations
│   ├── routes/       # API route handlers
│   ├── middleware/   # Auth and error handling
│   └── server.js     # Main server file
├── frontend/         # Next.js React application
│   ├── app/          # Next.js app router pages
│   ├── components/   # React components
│   └── lib/          # Utilities and API clients
└── install/          # Installation scripts
    ├── install.sh    # Linux/Mac installer
    ├── install.ps1   # Windows installer
    └── start-*.sh    # Start scripts
```

## API Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/servers` - Get all servers
- `GET /api/stats-combined/all` - Get combined system stats
- `GET /api/metrics/:serverId` - Get historical metrics
- `GET /api/logs/:serverId` - Get system logs
- `WS /api/terminal` - WebSocket terminal connection

## License

ISC

## Support

For issues, questions, or contributions, please open an issue on GitHub.

