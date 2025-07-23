const express = require('express')
const session = require('express-session');
const app = express()
const dotenv=require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
const passport = require('passport');
const path = require('path');
const cookieParser = require('cookie-parser');
const { createServer } = require('node:http');
const { Server } = require('socket.io');

const userRoutes=require('./routes/userRoutes')
const GoogleRoutes = require('./routes/googleRouter');
const User = require('./models/user');
require('./controllers/auth-google');

const PORT =process.env.PORT
const MONGODBLINK=process.env.MONGODBLINK

mongoose.connect(MONGODBLINK)
        .then(()=>{
            console.log('Connected to MongoDB');
        })
        .catch((error)=>{
            console.error('MongoDB connection error:', error);
        })

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static("public"))
app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, done) {
  done(null, user._id);
});

passport.deserializeUser(async function (id, done) {
  const user = await User.findById(id);
  done(null, user);
});

const server = createServer(app);
const io = new Server(server);
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
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.get('/', (req, res) => {
  res.render('signup');
});

app.use('/auth', GoogleRoutes);
app.use('/',userRoutes)

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})
// app.listen(PORT)