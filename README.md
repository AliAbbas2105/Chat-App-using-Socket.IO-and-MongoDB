# Real-Time Chat App

A real-time chat application built using **Express.js**, **Socket.IO**, and **MongoDB**.

## Features

- 🔐 **JWT Authentication** – Secure login/signup with JWT token and cookie parsing.
- 💬 **Real-Time Messaging** – Messages are delivered instantly using Socket.IO.
- 👥💬**Group Chat Room** - User can create/join/leave/delete(only group creator) the chat rooms.
- 📥 **Persistent Message Storage** – Messages are saved in the database even if the receiver is offline or chatting with someone else.
- 📊 **Unread Count** – Messages are marked as unread and updated to read when the user views the chat.
- 🔔 **Notifications** - Notification received on each message is shown, gets deleted when marked as read.
- 👤 **Chat History Sidebar** – Sidebar shows users you've chatted with, ordered by latest message.
- 🔍 **User Search** – Search users and start a new conversation.
- ⚡ **Message Sync** – Ensures seamless message synchronization across online/offline states.

## Technologies Used
- **Frontend**: HTML(EJS), CSS
- **Backend**: Express.js, Node.js
- **Real-Time**: Socket.IO
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, cookie-parser

## Getting Started

### Prerequisites

- Node.js installed
- MongoDB running locally or on a cloud service

### Installation

```bash
git clone https://github.com/AliAbbas2105/Chat-App-using-Socket.IO-and-MongoDB.git
cd Chat-App-using-Socket.IO-and-MongoDB
npm install
```
### Environment Variables

Create a `.env` file in the root from .env.example file


### Running the App

```bash
npm start
```

The app will run at `http://localhost:3000`

---

## License

This project is licensed under the MIT License.
