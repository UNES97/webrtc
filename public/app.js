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

async function initializeMedia(callType = 'video') {
    try {
        const constraints = callType === 'video' 
            ? { video: true, audio: true }
            : { video: false, audio: true };
            
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (callType === 'video') {
            localVideo.srcObject = localStream;
            localVideo.style.display = 'block';
        } else {
            localVideo.style.display = 'none';
        }
        
        localStream.getVideoTracks().forEach(track => {
            track.enabled = isVideoEnabled && callType === 'video';
        });
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isAudioEnabled;
        });
    } catch (error) {
        console.error('Error accessing media devices:', error);
        const mediaType = callType === 'video' ? 'camera and microphone' : 'microphone';
        alert(`Please allow ${mediaType} access to make ${callType} calls`);
    }
}

function createUserElement(username) {
    const userDiv = document.createElement('div');
    userDiv.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200';
    userDiv.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
            </div>
            <div>
                <span class="font-medium text-gray-900">${username}</span>
                <div class="w-2 h-2 bg-green-500 rounded-full inline-block ml-2"></div>
            </div>
        </div>
        <div class="flex space-x-2">
            <button onclick="startCall('${username}', 'audio')" class="w-10 h-10 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition-colors duration-200" title="Audio Call">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
            </button>
            <button onclick="startCall('${username}', 'video')" class="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition-colors duration-200" title="Video Call">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
            </button>
        </div>
    `;
    return userDiv;
}

async function startCall(targetUsername, callType) {
    if (currentCall) {
        alert('You are already in a call');
        return;
    }
    
    if (targetUsername === currentUsername) {
        alert('You cannot call yourself');
        return;
    }
    
    // Initialize media based on call type
    await initializeMedia(callType);
    
    currentCall = {
        target: targetUsername,
        type: callType,
        isInitiator: true
    };
    
    showCallStatus(`Calling ${targetUsername}...`);
    
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
        console.log('Received remote stream:', stream);
        remoteStream = stream;
        
        // Show/hide video elements based on call type
        if (currentCall.type === 'video') {
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
            // Ensure video plays (handle autoplay restrictions)  
            remoteVideo.play().catch(e => {
                console.log('Autoplay prevented, user interaction required:', e);
            });
        } else {
            // For audio calls, still set the stream but don't show video
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'none';
        }
        
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

async function answerCall(signal, caller, callType, callId) {
    console.log('Answering call from:', caller, 'Type:', callType);
    
    // Initialize media based on call type
    await initializeMedia(callType);
    
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
        console.log('Received remote stream:', stream);
        remoteStream = stream;
        
        // Show/hide video elements based on call type
        if (currentCall.type === 'video') {
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'block';
            // Ensure video plays (handle autoplay restrictions)
            remoteVideo.play().catch(e => {
                console.log('Autoplay prevented, user interaction required:', e);
            });
        } else {
            // For audio calls, still set the stream but don't show video
            remoteVideo.srcObject = stream;
            remoteVideo.style.display = 'none';
        }
        
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
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    remoteVideo.style.display = 'none';
    localVideo.style.display = 'none';
    
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