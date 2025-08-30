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
const mobileLocalVideo = document.getElementById('mobileLocalVideo');
const mobileRemoteVideo = document.getElementById('mobileRemoteVideo');
const mobileUsersList = document.getElementById('mobileUsersList');
const mobileEmptyUsersState = document.getElementById('mobileEmptyUsersState');
const mobileVideoPlaceholder = document.getElementById('mobileVideoPlaceholder');
const mobileToggleVideo = document.getElementById('mobileToggleVideo');
const mobileToggleAudio = document.getElementById('mobileToggleAudio');
const mobileEndCallBtn = document.getElementById('mobileEndCallBtn');
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
const videoPlaceholder = document.getElementById('videoPlaceholder');

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
            if (mobileLocalVideo) {
                mobileLocalVideo.srcObject = localStream;
                mobileLocalVideo.style.display = 'block';
            }
        } else {
            localVideo.style.display = 'none';
            if (mobileLocalVideo) {
                mobileLocalVideo.style.display = 'none';
            }
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

function createUserElement(username, isMobile = false) {
    const userDiv = document.createElement('div');
    
    if (isMobile) {
        userDiv.className = 'flex items-center justify-between p-2 bg-discord-light hover:bg-discord-accent/20 rounded transition-colors duration-200';
        userDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="w-6 h-6 bg-discord-accent rounded-full flex items-center justify-center">
                    <i data-lucide="user" class="w-3 h-3 text-white stroke-2"></i>
                </div>
                <div>
                    <span class="font-medium text-discord-text text-sm">${username}</span>
                    <div class="flex items-center space-x-1">
                        <div class="w-1.5 h-1.5 bg-discord-success rounded-full"></div>
                        <span class="text-xs text-discord-success font-medium">online</span>
                    </div>
                </div>
            </div>
            <div class="flex space-x-1">
                <button onclick="startCall('${username}', 'audio')" class="w-6 h-6 bg-discord-success hover:bg-green-600 text-white rounded flex items-center justify-center transition-colors duration-200" title="Audio Call">
                    <i data-lucide="phone" class="w-3 h-3 stroke-2"></i>
                </button>
                <button onclick="startCall('${username}', 'video')" class="w-6 h-6 bg-discord-accent hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors duration-200" title="Video Call">
                    <i data-lucide="video" class="w-3 h-3 stroke-2"></i>
                </button>
            </div>
        `;
    } else {
        userDiv.className = 'flex items-center justify-between p-3 bg-discord-light hover:bg-discord-accent/10 rounded transition-colors duration-200';
        userDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-discord-accent rounded-full flex items-center justify-center">
                    <i data-lucide="user" class="w-5 h-5 text-white stroke-2"></i>
                </div>
                <div>
                    <span class="font-medium text-discord-text text-sm">${username}</span>
                    <div class="flex items-center space-x-1 mt-0.5">
                        <div class="w-2 h-2 bg-discord-success rounded-full"></div>
                        <span class="text-xs text-discord-success font-medium">online</span>
                    </div>
                </div>
            </div>
            <div class="flex space-x-2">
                <button onclick="startCall('${username}', 'audio')" class="w-8 h-8 bg-discord-success hover:bg-green-600 text-white rounded flex items-center justify-center transition-colors duration-200" title="Audio Call">
                    <i data-lucide="phone" class="w-4 h-4 stroke-2"></i>
                </button>
                <button onclick="startCall('${username}', 'video')" class="w-8 h-8 bg-discord-accent hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors duration-200" title="Video Call">
                    <i data-lucide="video" class="w-4 h-4 stroke-2"></i>
                </button>
            </div>
        `;
    }
    
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
        remoteVideo.srcObject = stream;
        
        // Hide placeholder and show remote video
        if (videoPlaceholder) {
            videoPlaceholder.style.display = 'none';
        }
        if (mobileVideoPlaceholder) {
            mobileVideoPlaceholder.style.display = 'none';
        }
        
        // Show/hide video elements based on call type
        if (currentCall.type === 'video') {
            remoteVideo.style.display = 'block';
            if (mobileRemoteVideo) {
                mobileRemoteVideo.srcObject = stream;
                mobileRemoteVideo.style.display = 'block';
            }
            // Ensure video plays (handle autoplay restrictions)  
            remoteVideo.play().catch(e => {
                console.log('Autoplay prevented, user interaction required:', e);
            });
            if (mobileRemoteVideo) {
                mobileRemoteVideo.play().catch(e => {
                    console.log('Mobile autoplay prevented:', e);
                });
            }
        } else {
            // For audio calls, hide video but keep audio
            remoteVideo.style.display = 'none';
            if (mobileRemoteVideo) {
                mobileRemoteVideo.style.display = 'none';
            }
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
        remoteVideo.srcObject = stream;
        
        // Hide placeholder and show remote video
        if (videoPlaceholder) {
            videoPlaceholder.style.display = 'none';
        }
        if (mobileVideoPlaceholder) {
            mobileVideoPlaceholder.style.display = 'none';
        }
        
        // Show/hide video elements based on call type
        if (currentCall.type === 'video') {
            remoteVideo.style.display = 'block';
            if (mobileRemoteVideo) {
                mobileRemoteVideo.srcObject = stream;
                mobileRemoteVideo.style.display = 'block';
            }
            // Ensure video plays (handle autoplay restrictions)
            remoteVideo.play().catch(e => {
                console.log('Autoplay prevented, user interaction required:', e);
            });
            if (mobileRemoteVideo) {
                mobileRemoteVideo.play().catch(e => {
                    console.log('Mobile autoplay prevented:', e);
                });
            }
        } else {
            // For audio calls, hide video but keep audio
            remoteVideo.style.display = 'none';
            if (mobileRemoteVideo) {
                mobileRemoteVideo.style.display = 'none';
            }
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
    
    if (mobileRemoteVideo) {
        mobileRemoteVideo.srcObject = null;
        mobileRemoteVideo.style.display = 'none';
    }
    if (mobileLocalVideo) {
        mobileLocalVideo.srcObject = null;
        mobileLocalVideo.style.display = 'none';
    }
    
    // Show placeholder again
    if (videoPlaceholder) {
        videoPlaceholder.style.display = 'flex';
    }
    if (mobileVideoPlaceholder) {
        mobileVideoPlaceholder.style.display = 'flex';
    }
    
    currentCall = null;
    hideCallControls();
    hideCallStatus();
    hideIncomingCallModal();
    loadCallLogs();
}

function showCallControls() {
    endCallBtn.style.display = 'inline-block';
    if (mobileEndCallBtn) {
        mobileEndCallBtn.style.display = 'inline-block';
    }
}

function hideCallControls() {
    endCallBtn.style.display = 'none';
    if (mobileEndCallBtn) {
        mobileEndCallBtn.style.display = 'none';
    }
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
    
    // Update desktop button appearance
    const icon = toggleVideo.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', isVideoEnabled ? 'video' : 'video-off');
        lucide.createIcons();
    }
    toggleVideo.style.opacity = isVideoEnabled ? '1' : '0.5';
});

toggleAudio.addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = isAudioEnabled;
        });
    }
    
    // Update desktop button appearance
    const icon = toggleAudio.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', isAudioEnabled ? 'mic' : 'mic-off');
        lucide.createIcons();
    }
    toggleAudio.style.opacity = isAudioEnabled ? '1' : '0.5';
});

endCallBtn.addEventListener('click', endCall);

// Mobile controls event listeners
if (mobileToggleVideo) {
    mobileToggleVideo.addEventListener('click', () => {
        isVideoEnabled = !isVideoEnabled;
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoEnabled;
            });
        }
        
        // Update button appearance
        const icon = mobileToggleVideo.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isVideoEnabled ? 'video' : 'video-off');
            lucide.createIcons();
        }
        mobileToggleVideo.style.opacity = isVideoEnabled ? '1' : '0.5';
    });
}

if (mobileToggleAudio) {
    mobileToggleAudio.addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isAudioEnabled;
            });
        }
        
        // Update button appearance
        const icon = mobileToggleAudio.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isAudioEnabled ? 'mic' : 'mic-off');
            lucide.createIcons();
        }
        mobileToggleAudio.style.opacity = isAudioEnabled ? '1' : '0.5';
    });
}

if (mobileEndCallBtn) {
    mobileEndCallBtn.addEventListener('click', endCall);
}

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
    // Update desktop users list
    if (usersList) {
        usersList.innerHTML = '';
        users.forEach(username => {
            if (username !== currentUsername) {
                usersList.appendChild(createUserElement(username, false));
            }
        });
    }
    
    // Update mobile users list
    if (mobileUsersList) {
        mobileUsersList.innerHTML = '';
        users.forEach(username => {
            if (username !== currentUsername) {
                mobileUsersList.appendChild(createUserElement(username, true));
            }
        });
    }
    
    // Update empty states
    const hasOtherUsers = users.some(u => u !== currentUsername);
    if (document.getElementById('emptyUsersState')) {
        document.getElementById('emptyUsersState').style.display = hasOtherUsers ? 'none' : 'block';
    }
    if (mobileEmptyUsersState) {
        mobileEmptyUsersState.style.display = hasOtherUsers ? 'none' : 'block';
    }
    
    // Reinitialize icons after adding new elements
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
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