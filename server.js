const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Railway-specific database configuration
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
const dbPath = isProduction 
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/tmp', 'calls.db')
    : path.join(__dirname, 'calls.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Using database path: ${dbPath}`);

let db;
try {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
            process.exit(1);
        }
        console.log('Connected to SQLite database successfully');
    });
} catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        socket_id TEXT,
        is_online INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS call_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caller_username TEXT,
        callee_username TEXT,
        call_type TEXT,
        duration INTEGER DEFAULT 0,
        status TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME
    )`);
});

const connectedUsers = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/users', (req, res) => {
    if (!db) {
        return res.status(500).json({ error: 'Database not available' });
    }
    
    db.all("SELECT username, is_online FROM users WHERE is_online = 1", (err, rows) => {
        if (err) {
            console.error('Database error in /api/users:', err.message);
            res.status(500).json({ error: 'Failed to fetch users' });
            return;
        }
        res.json(rows || []);
    });
});

app.get('/api/call-logs', (req, res) => {
    if (!db) {
        return res.status(500).json({ error: 'Database not available' });
    }
    
    db.all("SELECT * FROM call_logs ORDER BY started_at DESC LIMIT 50", (err, rows) => {
        if (err) {
            console.error('Database error in /api/call-logs:', err.message);
            res.status(500).json({ error: 'Failed to fetch call logs' });
            return;
        }
        res.json(rows || []);
    });
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    if (!db) {
        return res.status(503).json({ status: 'unhealthy', message: 'Database not available' });
    }
    
    db.get("SELECT 1", (err) => {
        if (err) {
            return res.status(503).json({ status: 'unhealthy', message: 'Database connection failed' });
        }
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('register', (username) => {
        if (!username || typeof username !== 'string') {
            socket.emit('error', { message: 'Invalid username' });
            return;
        }
        
        connectedUsers.set(socket.id, username);
        
        if (!db) {
            console.error('Database not available for user registration');
            socket.emit('error', { message: 'Service temporarily unavailable' });
            return;
        }
        
        db.run("INSERT OR REPLACE INTO users (username, socket_id, is_online) VALUES (?, ?, 1)",
            [username, socket.id], (err) => {
                if (err) {
                    console.error('Database error during user registration:', err.message);
                    socket.emit('error', { message: 'Registration failed' });
                    return;
                }
                
                socket.username = username;
                socket.broadcast.emit('userConnected', username);
                
                db.all("SELECT username FROM users WHERE is_online = 1", (err, users) => {
                    if (err) {
                        console.error('Database error fetching users:', err.message);
                    } else {
                        io.emit('updateUserList', users.map(u => u.username));
                    }
                });
            });
    });
    
    socket.on('call-user', (data) => {
        const targetUser = Array.from(connectedUsers.entries())
            .find(([, username]) => username === data.to);
        
        if (targetUser) {
            const targetSocketId = targetUser[0];
            
            db.run("INSERT INTO call_logs (caller_username, callee_username, call_type, status) VALUES (?, ?, ?, 'initiated')",
                [socket.username, data.to, data.callType], function(err) {
                    if (!err) {
                        data.callId = this.lastID;
                    }
                });
            
            socket.to(targetSocketId).emit('incoming-call', {
                from: socket.username,
                signal: data.signal,
                callType: data.callType,
                callId: data.callId
            });
        } else {
            socket.emit('call-failed', { message: 'User not found or offline' });
        }
    });
    
    socket.on('answer-call', (data) => {
        const callerUser = Array.from(connectedUsers.entries())
            .find(([, username]) => username === data.to);
        
        if (callerUser) {
            const callerSocketId = callerUser[0];
            socket.to(callerSocketId).emit('call-accepted', {
                signal: data.signal,
                from: socket.username
            });
            
            if (data.callId) {
                db.run("UPDATE call_logs SET status = 'connected' WHERE id = ?", [data.callId]);
            }
        }
    });
    
    socket.on('reject-call', (data) => {
        const callerUser = Array.from(connectedUsers.entries())
            .find(([, username]) => username === data.to);
        
        if (callerUser) {
            const callerSocketId = callerUser[0];
            socket.to(callerSocketId).emit('call-rejected', {
                from: socket.username
            });
            
            if (data.callId) {
                db.run("UPDATE call_logs SET status = 'rejected', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [data.callId]);
            }
        }
    });
    
    socket.on('end-call', (data) => {
        if (data.to) {
            const targetUser = Array.from(connectedUsers.entries())
                .find(([, username]) => username === data.to);
            
            if (targetUser) {
                const targetSocketId = targetUser[0];
                socket.to(targetSocketId).emit('call-ended', {
                    from: socket.username
                });
            }
        }
        
        if (data.callId) {
            db.run("UPDATE call_logs SET status = 'completed', ended_at = CURRENT_TIMESTAMP WHERE id = ?", [data.callId]);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const username = connectedUsers.get(socket.id);
        
        if (username) {
            connectedUsers.delete(socket.id);
            
            db.run("UPDATE users SET is_online = 0, socket_id = NULL WHERE username = ?", [username], (err) => {
                if (!err) {
                    socket.broadcast.emit('userDisconnected', username);
                    
                    db.all("SELECT username FROM users WHERE is_online = 1", (err, users) => {
                        if (!err) {
                            io.emit('updateUserList', users.map(u => u.username));
                        }
                    });
                }
            });
        }
    });
});

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database path: ${dbPath}`);
    if (!isProduction) {
        console.log(`Open http://localhost:${PORT} in your browser`);
    }
});