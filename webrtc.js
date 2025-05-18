const { Server } = require("socket.io");
const { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } = require("werift");

module.exports = function (server) {
  const io = new Server(server);
  const rooms = new Map(); // roomName => Map<userId, peer>

  io.on("connection", (socket) => {
    let currentRoom = null;
    let userId = socket.id;
    let peer = null;

    socket.on("join", async ({ roomName, username, userGender}) => {
      currentRoom = roomName;
      if (!rooms.has(roomName)) rooms.set(roomName, new Map());

      // create a new peer connection for this user
      peer = new RTCPeerConnection();
      rooms.get(roomName).set(userId, { socket, peer, username, userGender});

      // when this peer gets a track, forward it to other users
      peer.ontrack = (event) => {
        rooms.get(roomName).forEach(({ socket: otherSocket, peer: otherPeer }, otherId) => {
          if (otherId === userId) return;
          for (const track of event.streams[0].getTracks()) {
            otherPeer.addTrack(track, event.streams[0]);
          }
        });
      };

      socket.emit("joined", { userId });
    });

    socket.on("offer", async ({ sdp }) => {
        try {
            if (peer.signalingState !== "stable") {
                console.warn(`Signaling state is ${peer.signalingState}, expecting 'stable'.`);
                return;
            }

            await peer.setRemoteDescription(sdp);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("answer", { sdp: peer.localDescription });
        } catch (err) {
            console.error("Error setting the remote description:", err);
        }
    });

    socket.on("candidate", async ({ candidate }) => {
      if (candidate) await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("disconnect", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(userId);
        if (rooms.get(currentRoom).size === 0) {
          rooms.delete(currentRoom);
        }
      }
      if (peer) peer.close();
      console.log(`Client ${userId} disconnected`);
    });
  });
};