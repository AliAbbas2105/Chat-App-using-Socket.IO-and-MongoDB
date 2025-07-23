const express = require("express")
const app = express()
require("dotenv").config()
const { createServer } = require('node:http');
const { Server } = require('socket.io');


const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"))
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("homepage");
});
let serverCounter = 1;
io.on('connection', (socket) => {
  console.log('a user connected');
  socket.serverId = serverCounter++;
  socket.on('chat message', (msg) => {
    const fullMessage = `server ${socket.serverId}: ${msg}`;
    io.emit('chat message', fullMessage);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})