const { Server } = require("socket.io");
const { RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } = require("werift");

module.exports = function (server) {
  const io = new Server(server);
  const rooms = new Map(); // roomName => Map<userId, peer>

  io.on("connection", (socket) => {
    let currentRoom = null;
    let userId = socket.id;
    let peer = null;

    socket.on("join", async ({ roomName, username, userGender }) => {
        currentRoom = roomName;
        if (!rooms.has(roomName)) rooms.set(roomName, new Map());

        //Create peer for new user
        peer = new RTCPeerConnection();
        rooms.get(roomName).set(userId, { socket, peer, username, userGender });

        const roomPeers = rooms.get(roomName);

         // ⬇️ Send previous tracks of other peers to new user
         for (const [otherUserId, otherPeerObj] of roomPeers.entries()) {
             if (otherUserId === userId) continue;

             for (const oldTrack of otherPeerObj.tracks || []) {
                 await peer.addTrack(oldTrack);
             }
         }

         //If this new peer receives tracks, forward them to others
         peer.onTrack.subscribe((track) => {
         console.log(`[${userId}] Received track, forwarding to others in room [${roomName}]`);

         //Save track
         const user = rooms.get(roomName).get(userId);
         if (!user.tracks) user.tracks = [];
         user.tracks.push(track);

         for (const [otherUserId, otherUser] of rooms.get(roomName)) {
             if (otherUserId === userId) continue;

             otherUser.peer.addTrack(track);
             console.log(`--> Forwarded track to [${otherUserId}]`);
         }
     });

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