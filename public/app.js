const socket = io();
let localStream;
let remoteStream;
let peer;
let currentCall = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let currentUsername = '';

const loginSection = document.getElementById('loginSection');
const mainSection = document.getElementById('mainSection');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const usersList = document.getElementById('usersList');
const currentUserSpan = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleVideo = document.getElementById('toggleVideo');
const toggleAudio = document.getElementById('toggleAudio');
const endCallBtn = document.getElementById('endCallBtn');
const incomingCallModal = document.getElementById('incomingCallModal');
const callerName = document.getElementById('callerName');
const callType = document.getElementById('callType');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const callLogsList = document.getElementById('callLogsList');

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        socket.emit('register', username);
        currentUserSpan.textContent = username;
        loginSection.style.display = 'none';
        mainSection.style.display = 'flex';
        logoutBtn.style.display = 'inline';
        initializeMedia();
        loadCallLogs();
    }
});

logoutBtn.addEventListener('click', () => {
    location.reload();
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        localVideo.srcObject = localStream;
        
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isVideoEnabled;
        });
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isAudioEnabled;
        });
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please allow camera and microphone access to use this app');
    }
}

function createUserElement(username) {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    userDiv.innerHTML = `
        <span class="username">${username}</span>
        <div class="call-buttons">
            <button onclick="startCall('${username}', 'audio')" class="call-btn audio">🎤</button>
            <button onclick="startCall('${username}', 'video')" class="call-btn video">📹</button>
        </div>
    `;
    return userDiv;
}

function startCall(targetUsername, callType) {
    if (currentCall) {
        alert('You are already in a call');
        return;
    }
    
    if (targetUsername === currentUsername) {
        alert('You cannot call yourself');
        return;
    }
    
    currentCall = {
        target: targetUsername,
        type: callType,
        isInitiator: true
    };
    
    showCallStatus(`Calling ${targetUsername}...`);
    
    const constraints = callType === 'video' 
        ? { video: true, audio: true }
        : { video: false, audio: true };
    
    peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream
    });
    
    peer.on('signal', (signal) => {
        socket.emit('call-user', {
            to: targetUsername,
            signal: signal,
            callType: callType
        });
    });
    
    peer.on('stream', (stream) => {
        remoteStream = stream;
        remoteVideo.srcObject = stream;
        
        // Ensure video plays (handle autoplay restrictions)  
        remoteVideo.play().catch(e => {
            console.log('Autoplay prevented, user interaction required:', e);
        });
        
        showCallControls();
        hideCallStatus();
    });
    
    peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        endCall();
    });
    
    peer.on('close', () => {
        endCall();
    });
}

function answerCall(signal, caller, callType, callId) {
    console.log('Answering call from:', caller, 'Type:', callType);
    
    currentCall = {
        target: caller,
        type: callType,
        isInitiator: false,
        callId: callId
    };
    
    peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: localStream
    });
    
    peer.on('signal', (answerSignal) => {
        socket.emit('answer-call', {
            to: caller,
            signal: answerSignal,
            callId: callId
        });
    });
    
    peer.on('stream', (stream) => {
        remoteStream = stream;
        remoteVideo.srcObject = stream;
        
        // Ensure video plays (handle autoplay restrictions)
        remoteVideo.play().catch(e => {
            console.log('Autoplay prevented, user interaction required:', e);
        });
        
        showCallControls();
    });
    
    peer.on('error', (err) => {
        console.error('Peer connection error:', err);
        endCall();
    });
    
    peer.on('close', () => {
        endCall();
    });
    
    peer.signal(signal);
}

function endCall() {
    if (currentCall) {
        socket.emit('end-call', { 
            to: currentCall.target,
            callId: currentCall.callId
        });
    }
    
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    remoteVideo.srcObject = null;
    currentCall = null;
    hideCallControls();
    hideCallStatus();
    hideIncomingCallModal();
    loadCallLogs();
}

function showCallControls() {
    endCallBtn.style.display = 'inline-block';
}

function hideCallControls() {
    endCallBtn.style.display = 'none';
}

function showCallStatus(message) {
    callStatusText.textContent = message;
    callStatus.style.display = 'block';
}

function hideCallStatus() {
    callStatus.style.display = 'none';
}

function showIncomingCallModal(caller, callType) {
    callerName.textContent = caller;
    document.getElementById('callType').textContent = callType;
    incomingCallModal.style.display = 'block';
}

function hideIncomingCallModal() {
    incomingCallModal.style.display = 'none';
}

async function loadCallLogs() {
    try {
        const response = await fetch('/api/call-logs');
        const logs = await response.json();
        
        callLogsList.innerHTML = '';
        logs.forEach(log => {
            const logDiv = document.createElement('div');
            logDiv.className = 'call-log-item';
            
            const date = new Date(log.started_at).toLocaleString();
            const duration = log.ended_at 
                ? Math.floor((new Date(log.ended_at) - new Date(log.started_at)) / 1000) + 's'
                : 'N/A';
            
            logDiv.innerHTML = `
                <div class="call-info">
                    <strong>${log.caller_username} → ${log.callee_username}</strong>
                    <span class="call-type">${log.call_type}</span>
                </div>
                <div class="call-meta">
                    <span class="status ${log.status}">${log.status}</span>
                    <span class="duration">${duration}</span>
                    <span class="date">${date}</span>
                </div>
            `;
            
            callLogsList.appendChild(logDiv);
        });
    } catch (error) {
        console.error('Error loading call logs:', error);
    }
}

toggleVideo.addEventListener('click', () => {
    isVideoEnabled = !isVideoEnabled;
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isVideoEnabled;
        });
    }
    toggleVideo.classList.toggle('disabled', !isVideoEnabled);
});

toggleAudio.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isAudioEnabled;
        });
    }
    toggleAudio.classList.toggle('disabled', !isAudioEnabled);
});

endCallBtn.addEventListener('click', endCall);

acceptCallBtn.addEventListener('click', () => {
    console.log('Accept button clicked, incomingCallData:', window.incomingCallData);
    hideIncomingCallModal();
    
    if (window.incomingCallData) {
        answerCall(
            window.incomingCallData.signal,
            window.incomingCallData.caller,
            window.incomingCallData.callType,
            window.incomingCallData.callId
        );
        
        // Clear the temporary data
        window.incomingCallData = null;
    } else {
        console.error('No incoming call data found!');
    }
});

rejectCallBtn.addEventListener('click', () => {
    if (window.incomingCallData) {
        socket.emit('reject-call', { 
            to: window.incomingCallData.caller,
            callId: window.incomingCallData.callId
        });
        
        // Clear the temporary data
        window.incomingCallData = null;
    }
    
    hideIncomingCallModal();
});

refreshLogsBtn.addEventListener('click', loadCallLogs);

socket.on('updateUserList', (users) => {
    usersList.innerHTML = '';
    users.forEach(username => {
        if (username !== currentUsername) {
            usersList.appendChild(createUserElement(username));
        }
    });
});

socket.on('incoming-call', (data) => {
    if (currentCall) {
        socket.emit('reject-call', { to: data.from, callId: data.callId });
        return;
    }
    
    // Store incoming call data temporarily for accept/reject
    window.incomingCallData = {
        signal: data.signal,
        caller: data.from,
        callType: data.callType,
        callId: data.callId
    };
    
    showIncomingCallModal(data.from, data.callType);
});

socket.on('call-accepted', (data) => {
    if (peer) {
        peer.signal(data.signal);
    }
    hideCallStatus();
});

socket.on('call-rejected', (data) => {
    showCallStatus(`${data.from} rejected your call`);
    setTimeout(() => {
        endCall();
    }, 2000);
});

socket.on('call-ended', (data) => {
    endCall();
});

socket.on('call-failed', (data) => {
    showCallStatus(data.message);
    setTimeout(() => {
        hideCallStatus();
        currentCall = null;
    }, 3000);
});

socket.on('userConnected', (username) => {
    console.log('User connected:', username);
});

socket.on('userDisconnected', (username) => {
    console.log('User disconnected:', username);
});

window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    endCall();
});