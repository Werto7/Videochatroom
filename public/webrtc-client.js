// webrtc-client.js
(async ()=> {
  let currentCamera = "user"; // front
  const localVideo = document.getElementById("local-video");
  const fullscreenVideo = document.getElementById("fullscreen-video");
  const socket = io();

let localStream = null;
let videoTrack = null;
let audioTrack = null;
  
const mainContainer = document.getElementById("main-container");

const actionBar = document.getElementById("action-bar");
const micIcon = document.getElementById("mic-icon");
const videoIcon = document.getElementById("video-icon");
const switchBtn = document.getElementById("switch-camera");
const secondContainer = document.getElementById("second-container");

const peers = {};
const containers = {};
const roomname = room;

let pc = null;
let remoteCount = 0;

//Get media
async function startVideo() {
  try {
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { 
          facingMode: currentCamera,
          width: { ideal: 640 },  // 640px = 360p (Breite)
          height: { ideal: 360 },
          frameRate: { ideal: 30 }
      }
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

    // Set local video stream
    localVideo.srcObject = null;
    localVideo.srcObject = localStream;

    //Only set the icon if everything worked
    videoIcon.src = "/icons/video-on.jpg";

    await renegotiate?.();
  } catch (error) {
    console.error("Error starting the camera:", error);
    alert("Camera could not be activated: " + (error.message || error));
  }
}

async function startAudio() {
  try {
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
      micIcon.src = "/icons/mic-on.jpg";
      await renegotiate?.();
  } catch (error) {
  	alert("Microphone could not be activated: " + (error.message || error));
  }
}

async function startLocalStream() {
  const transformValue = currentCamera === "user" ? "scaleX(-1)" : "scaleX(1)";
  localVideo.style.transform = transformValue;
  fullscreenVideo.style.transform = transformValue;
  await Promise.all([startVideo(), startAudio()]);
}

//Microphone on/off
micIcon.addEventListener("click", async () => {
  try {
    if (audioTrack && audioTrack.readyState !== "ended") {
      audioTrack.stop();
      localStream.removeTrack(audioTrack);
      audioTrack = null;
      micIcon.src = "/icons/mic-off.jpg";
    } else {
      await startAudio();
    }

    //Create and send new SDP offers after track changes
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { sdp: pc.localDescription });
  } catch (error) {
    alert("Error switching microphone: " + error.message);
  }
});

//video on/off
videoIcon.addEventListener("click", async () => {
  if (videoTrack && videoTrack.readyState === "live") {
    videoTrack.stop();
    localStream.removeTrack(videoTrack);
    pc.getSenders().forEach(sender => {
      if (sender.track === videoTrack) {
        pc.removeTrack(sender);
      }
    });
    videoTrack = null;
    videoIcon.src = "/icons/video-off.jpg";
  } else {
    await startVideo();
    //Add new video track to pc;
    const newVideoTrack = videoTrack; //from startVideo()
    pc.addTrack(newVideoTrack, localStream);
    videoIcon.src = "/icons/video-on.jpg";
  }

  //Now: Create new offer, send to server
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { sdp: pc.localDescription });
});

//Switch camera
switchBtn.addEventListener("click", async () => {
  try {
    currentCamera = currentCamera === "user" ? "environment" : "user";

    //Just change camera, microphone remains
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

    console.log("Camera changed:", newVideoTrack.label);
  } catch (error) {
    console.error("Error when changing camera:", error);
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

async function joinRoom() {
  socket.emit("join", {
  roomName: roomname,
  userName: username,
  userGender: gender
});

  socket.on("joined", async ({ userId }) => {
    await startLocalStream();
    pc = new RTCPeerConnection();
    //Add local tracks
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    //Receive remote track
    pc.ontrack = (event) => {
    	const id = `remote-${remoteCount++}`;
    
        if (containers[id]) return;
    
    	const remoteStream = new MediaStream();
        remoteStream.addTrack(event.track);

        const div = document.createElement("div");
        div.classList.add("video-container");
        
        const video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = remoteStream;

        div.appendChild(video);
        mainContainer.appendChild(div);
        containers[id] = div; 
    };
    
    if (pc.signalingState !== "stable") {
        await new Promise((resolve) => {
            const checkState = () => {
                if (pc.signalingState === "stable") {
                    pc.removeEventListener("signalingstatechange", checkState);
                    resolve();
                }
            };
            pc.addEventListener("signalingstatechange", checkState);
        });
    }

    // ICE-Candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("candidate", { candidate });
      }
    };

    //Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { sdp: pc.localDescription });
  });

  socket.on("answer", async ({ sdp }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  });

  socket.on("candidate", async ({ candidate }) => {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding remote ICE candidate:", err);
    }
  });
  
  socket.on("disconnect", () => {
  if (pc) {
    pc.close();
    pc = null;
  }
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  videoTrack = null;
  audioTrack = null;
});
}

joinRoom(); //start automatic

async function renegotiate() {
  if (!pc) {
    console.warn("Cannot renegotiate: pc is null");
    return;
  }
  if (pc.signalingState !== "stable") {
        await new Promise((resolve) => {
            const checkState = () => {
                if (pc.signalingState === "stable") {
                    pc.removeEventListener("signalingstatechange", checkState);
                    resolve();
                }
            };
            pc.addEventListener("signalingstatechange", checkState);
        });
    }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", { sdp: pc.localDescription });
}

function isPcReady() {
  return pc && typeof pc.createOffer === "function";
}
})();