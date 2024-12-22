// Import dependencies
import socket from "./user_socket.js";
import "phoenix_html"; // Handles method=PUT/DELETE in forms and buttons.

// Generate a unique ID for this tab (peer)
let room = null;
let peerId = Math.random().toString(36).substring(2); // Unique ID for this tab

// Phoenix channel setup
let channel = socket.channel("call", {});
channel
  .join()
  .receive("ok", () => {
    console.log("Joined successfully");
  })
  .receive("error", () => {
    console.log("Unable to join");
  });

// Video and button elements
let localStream, peerConnection;
let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let connectButton = document.getElementById("connect");
let callButton = document.getElementById("call");
let hangupButton = document.getElementById("hangup");

// Button states
hangupButton.disabled = true;
callButton.disabled = true;

// Button event listeners
connectButton.onclick = connect;
callButton.onclick = call;
hangupButton.onclick = hangup;

function connect() {
  console.log("Requesting local stream");
  navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then(gotStream)
    .catch((error) => {
      console.error("getUserMedia error:", error);
    });
}

function gotStream(stream) {
  console.log("Received local stream");
  localStream = stream;
  localVideo.srcObject = stream;
  setupPeerConnection();
}

function setupPeerConnection() {
  connectButton.disabled = true;
  callButton.disabled = false;
  hangupButton.disabled = false;
  console.log("Setting up peer connection");

  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.ontrack = (event) => {
    console.log("Track received:", event.track.kind);
    const [remoteStream] = event.streams;
    
    if (remoteStream) {
      console.log("Setting remote stream", remoteStream.id);
      remoteVideo.srcObject = remoteStream;
      
      event.track.onunmute = () => {
        console.log(`${event.track.kind} track unmuted`);
        if (event.track.kind === 'video') {
          remoteVideo.play()
            .catch(e => console.warn("Auto-play failed:", e));
        }
      };

      remoteStream.onaddtrack = () => {
        console.log("Track added to stream");
        if (remoteVideo.srcObject !== remoteStream) {
          remoteVideo.srcObject = remoteStream;
        }
      };
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("Connection state:", peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      console.log("Peers connected successfully");
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE state:", peerConnection.iceConnectionState);
  };

  peerConnection.onsignalingstatechange = () => {
    console.log("Signaling state:", peerConnection.signalingState);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate:", event.candidate.type);
      sendMessage("candidate", { 
        candidate: event.candidate,
        streamId: localStream.id
      });
    }
  };
}

function sendMessage(type, message) {
  channel.push("message", {
    body: JSON.stringify({
      type: type,
      peerId: peerId,
      ...message
    })
  });
}

function call() {
  callButton.disabled = true;
  console.log("Starting call");
  peerConnection.createOffer()
    .then((description) => {
      return peerConnection.setLocalDescription(description);
    })
    .then(() => {
      sendMessage("sdp", { sdp: peerConnection.localDescription });
    })
    .catch(handleError);
}

function gotRemoteDescription(description) {
  console.log("Remote description received:", description);
  const remoteDesc = new RTCSessionDescription(description.sdp);
  peerConnection.setRemoteDescription(remoteDesc)
    .then(() => {
      if (description.type === "offer") {
        return peerConnection.createAnswer();
      }
    })
    .then((answer) => {
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      sendMessage("sdp", { sdp: peerConnection.localDescription });
    })
    .catch(handleError);
}

let iceCandidateQueue = [];

function gotRemoteIceCandidate(candidate) {
  if (!peerConnection || !peerConnection.remoteDescription) {
    iceCandidateQueue.push(candidate);
    return;
  }
  try {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => console.log("Added ICE candidate"))
      .catch((error) => console.error("Error adding ICE candidate:", error));
  } catch (e) {
    console.error("Error creating ICE candidate:", e);
  }
}

function processIceCandidateQueue() {
  iceCandidateQueue.forEach(candidate => {
    gotRemoteIceCandidate(candidate);
  });
  iceCandidateQueue = [];
}

function hangup() {
  console.log("Ending call");
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  hangupButton.disabled = true;
  connectButton.disabled = false;
  callButton.disabled = true;
}

function handleError(error) {
  console.error("Error:", error.name, error.message);
}

channel.on("message", (payload) => {
  const message = JSON.parse(payload.body);
  console.log("Received message type:", message.type);

  if (message.peerId !== peerId) {
    if (message.type === "sdp") {
      console.log("Processing SDP");
      gotRemoteDescription(message);
    } else if (message.type === "candidate") {
      console.log("Processing ICE candidate");
      gotRemoteIceCandidate(message.candidate);
    }
  }
});