# WebRTC Audio/Video Calling App

A real-time audio and video calling application built with WebRTC, Socket.io, Express.js, and SQLite.

## Features

- **Audio & Video Calls**: Support for both audio-only and video calls
- **Real-time Communication**: WebRTC peer-to-peer connections with Socket.io signaling
- **User Management**: Online user tracking and status
- **Call History**: SQLite database stores call logs and user data
- **Responsive Design**: Works on desktop and mobile devices
- **Call Controls**: Toggle audio/video, end calls, accept/reject incoming calls

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io for signaling
- **WebRTC**: SimplePeer for peer connections
- **Database**: SQLite3 for data storage

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Join the App**: Enter a username to join
2. **View Online Users**: See who's currently online
3. **Make Calls**: Click the audio (🎤) or video (📹) button next to any user
4. **Answer Calls**: Accept or reject incoming calls
5. **Call Controls**: Toggle audio/video, end calls during active sessions
6. **Call History**: View recent call logs with status and duration

## File Structure

```
WEBRTC/
├── server.js              # Express server with Socket.io signaling
├── package.json           # Dependencies and scripts
├── calls.db              # SQLite database (auto-created)
└── public/
    ├── index.html        # Main HTML interface
    ├── app.js           # Client-side WebRTC logic
    └── style.css        # Responsive CSS styling
```

## Database Schema

### Users Table
- `id`: Primary key
- `username`: Unique username
- `socket_id`: Current socket connection ID
- `is_online`: Online status (0/1)
- `created_at`: Registration timestamp

### Call Logs Table
- `id`: Primary key
- `caller_username`: Initiator of the call
- `callee_username`: Recipient of the call
- `call_type`: 'audio' or 'video'
- `duration`: Call duration in seconds
- `status`: 'initiated', 'connected', 'completed', 'rejected'
- `started_at`: Call start timestamp
- `ended_at`: Call end timestamp

## API Endpoints

- `GET /`: Main application interface
- `GET /api/users`: Get list of online users
- `GET /api/call-logs`: Get recent call history

## WebRTC Flow

1. **Signaling**: Socket.io handles offer/answer exchange
2. **ICE Candidates**: Automatic peer discovery
3. **Media Stream**: Camera/microphone access
4. **Peer Connection**: Direct P2P communication
5. **Call Management**: Handle connection states

## Browser Requirements

- Modern browsers with WebRTC support
- HTTPS required for production (camera/microphone access)
- Camera and microphone permissions needed

## Development

For development with auto-reload:
```bash
npm run dev
```

## Security Notes

- Users are identified by username only (no authentication)
- All calls are peer-to-peer (not stored/recorded)
- SQLite database stores only metadata (no media content)
- HTTPS recommended for production deployment