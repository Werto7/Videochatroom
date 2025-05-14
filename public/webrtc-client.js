// webrtc-client.js
(async ()=> {
  let currentCamera = "user"; // front
  const localVideo = document.getElementById("local-video");
  const fullscreenVideo = document.getElementById("fullscreen-video");
  let localStream;
  let videoTrack;
  let audioTrack;
  await startLocalStream();
  const socket = io({ query: { room, username, gender }});
  sendMediaStatus();
const peers = {};          // socketId → RTCPeerConnection
const containers = {};     // socketId → DOM-Container
const mainContainer = document.getElementById("main-container");

const actionBar = document.getElementById("action-bar");
const micIcon = document.getElementById("mic-icon");
const videoIcon = document.getElementById("video-icon");
const switchBtn = document.getElementById("switch-camera");
const secondContainer = document.getElementById("second-container");

// Medien holen
async function startVideo() {
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentCamera }
  });
  const newVideoTrack = videoStream.getVideoTracks()[0];

  if (!localStream) {
    localStream = new MediaStream();
  }

  if (videoTrack) {
    videoTrack.stop();
    localStream.removeTrack(videoTrack);
  }

  localStream.addTrack(newVideoTrack);
  videoTrack = newVideoTrack;

  // Wichtig: Setze das komplette localStream neu als Quelle!
  localVideo.srcObject = null;
  localVideo.srcObject = localStream;
}

async function startAudio() {
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: true
  });
  const newAudioTrack = audioStream.getAudioTracks()[0];
  if (!localStream) {
    localStream = new MediaStream();
  }
  if (audioTrack) {
    audioTrack.stop();
    localStream.removeTrack(audioTrack);
  }
  localStream.addTrack(newAudioTrack);
  audioTrack = newAudioTrack;
  localVideo.srcObject = localStream;
}

async function startLocalStream() {
  const transformValue = currentCamera === "user" ? "scaleX(-1)" : "scaleX(1)";
  localVideo.style.transform = transformValue;
  fullscreenVideo.style.transform = transformValue;
  await Promise.all([startVideo(), startAudio()]);
}

// Mikrofon ein/aus
micIcon.addEventListener("click", async () => {
  try {
    if (audioTrack && audioTrack.readyState !== "ended") {
      audioTrack.stop();
      localStream.removeTrack(audioTrack);
      audioTrack = null;
      micIcon.src = "/icons/mic-off.jpg";
    } else {
      await startAudio();
      micIcon.src = "/icons/mic-on.jpg";
    }
    sendMediaStatus();
  } catch (error) {
    alert("Fehler beim Umschalten des Mikrofons:", error);
  }
});

// Video ein/aus
videoIcon.addEventListener("click", async () => {
  if (videoTrack && videoTrack.readyState === "live") {
    videoTrack.stop();
    localStream.removeTrack(videoTrack);
    videoTrack = null;
    videoIcon.src = "/icons/video-off.jpg";
  } else {
    await startVideo();
    videoIcon.src = "/icons/video-on.jpg";
  }
  sendMediaStatus();
});

// Kamera wechseln
switchBtn.addEventListener("click", async () => {
  try {
    currentCamera = currentCamera === "user" ? "environment" : "user";

    // Nur Kamera wechseln, Mikrofon bleibt erhalten
    if (videoTrack) {
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
    }

    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentCamera }
    });

    const newVideoTrack = videoStream.getVideoTracks()[0];
    localStream.addTrack(newVideoTrack);
    videoTrack = newVideoTrack;

    localVideo.srcObject = null;
    localVideo.srcObject = localStream;
    
    const transformValue = currentCamera === "user" ? "scaleX(-1)" : "scaleX(1)";
    localVideo.style.transform = transformValue;
    fullscreenVideo.style.transform = transformValue;

    videoIcon.src = "/icons/video-on.jpg";
    sendMediaStatus();

    console.log("Kamera gewechselt:", newVideoTrack.label);
  } catch (error) {
    console.error("Fehler beim Kamerawechsel:", error);
  }
});

localVideo.addEventListener("dblclick", () => {
  fullscreenVideo.srcObject = localVideo.srcObject;
  fullscreenVideo.muted = true;
  fullscreenVideo.play();

  mainContainer.style.display = "none";
  secondContainer.style.display = "flex";
});
  
fullscreenVideo.addEventListener("dblclick", () => {
    localVideo.srcObject = fullscreenVideo.srcObject;
    localVideo.play();

    secondContainer.style.display = "none";
    mainContainer.style.display = "block";
  });
  
socket.on("roomData", users => {
  // users ist ein Object socketId → { userId, username, gender }
  // 1. Entferne Container, die nicht mehr da sind
  Object.keys(containers).forEach(id => {
    if (!users[id]) {
      mainContainer.removeChild(containers[id]);
      delete containers[id];
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
      }
    }
  });

  // 2. Für alle verbleibenden Users: Container ggf. neu anlegen + Peer starten
  Object.entries(users).forEach(([id, meta]) => {
    if (id === socket.id) return; // unser eigenes Video überspringen
    if (!containers[id]) {
      // Container neu erzeugen
      const div = document.createElement("div");
      div.classList.add("video-container");
      // Gender-Icon
      const g = document.createElement("img");
      g.src = meta.gender === "male" ? "/icons/male.png" : "/icons/female.png";
      g.classList.add("gender-icon");
      div.appendChild(g);
      // Video-Element
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      div.appendChild(v);
      // Overlay mit Name + Mic-Status
      const ov = document.createElement("div");
      ov.classList.add("overlay");
      const micImg = document.createElement("img");
      micImg.classList.add("mic-off");
      micImg.src = "/icons/mic-off.jpg";
      micImg.style.display = "none"; // initial
      const nameLabel = document.createElement("span");
      nameLabel.classList.add("label");
      nameLabel.textContent = meta.username;
      ov.appendChild(micImg);
      ov.appendChild(nameLabel);
      div.appendChild(ov);

      mainContainer.appendChild(div);
      containers[id] = div;

      // PeerConnection initialisieren
      const isNewUser = Object.keys(users).indexOf(socket.id) > Object.keys(users).indexOf(id);
      initPeer(id, v, isNewUser);
    }
  });
});

socket.on("signal", async ({ from, data }) => {
  const pc = peers[from];
  if (!pc) return;

  if (data.description) {
    await pc.setRemoteDescription(data.description);
    if (data.description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("signal", {
        to: from,
        from: socket.id,
        data: { description: pc.localDescription }
      });
    }
  } else if (data.candidate) {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch (err) {
      console.error("Fehler bei addIceCandidate:", err);
    }
  }
});

async function initPeer(remoteId, videoElem, sendOffer = false) {
  while (!localStream) await new Promise(r => setTimeout(r, 100));

  const pc = new RTCPeerConnection(/* ... */);
  peers[remoteId] = pc;

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit("signal", { to: remoteId, from: socket.id, data: { candidate } });
    }
  };

  pc.ontrack = ({ streams: [stream] }) => {
    videoElem.srcObject = stream;
  };

  if (sendOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: remoteId, from: socket.id, data: { description: pc.localDescription } });
  }
}

async function sendMediaStatus() {
  while (!socket) await new Promise(r => setTimeout(r, 100));
  socket.emit("mediaStatus", {
    video: videoTrack?.enabled,
    audio: audioTrack?.enabled
  });
}
})();