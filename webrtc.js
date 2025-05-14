// webrtc.js
const { Server } = require("socket.io");

module.exports = function(httpServer) {
  const io = new Server(httpServer);

  // pro Raum speichern wir Sockets
  const rooms = {};

  io.on("connection", socket => {
    // sobald ein Client connectet, bekommt er { room, userId, userName, gender } aus session
    const userId = socket.handshake.query.userId || socket.id;
    const { room, username, gender } = socket.handshake.query;
    socket.join(room);
    
    rooms[room] = rooms[room] || {};
    rooms[room][socket.id] = { userId, username, gender };

    // Informiere alle im Raum über den neuen Teilnehmer
    io.to(room).emit("roomData", rooms[room]);

    // Signaling-Nachrichten weiterleiten
    socket.on("signal", ({ to, from, data }) => {
      io.to(to).emit("signal", { from, data });
    });

    socket.on("disconnect", () => {
      delete rooms[room][socket.id];
      io.to(room).emit("roomData", rooms[room]);
    });
    
    socket.on("mediaStatus", status => {
        // z.B. speichern oder an andere im Raum senden
    });
  });

  return io;
};