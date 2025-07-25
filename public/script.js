const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const userList = document.getElementById('userList');
const searchInput = document.getElementById('searchInput');
const currentUserName = document.getElementById('currentUserName');
currentUserName.textContent = CURRENT_USER;

let selectedUser = null;
let users = [];
let unreadCounts = {};
let chatHistory = {};

async function fetchUnreadCounts() {
  try {
    const res = await fetch('/users/unread-counts');
    unreadCounts = await res.json();
    renderUserList(users); // Updates display with new counts
  } catch (err) {
    console.error('Failed to fetch unread counts:', err);
  }
}

// Fetch chatted users on load
async function fetchChattedUsers() {
  const res = await fetch('/users/chatted');
  users = await res.json();
  await fetchUnreadCounts(); // Get initial unread counts
  renderUserList(users);
}

// Fetch chat history with a user
async function fetchChatHistory(userId) {
  const res = await fetch(`/messages/history/${userId}`);
  const history = await res.json();
  chatHistory[userId] = history;
  renderMessages(history);
  scrollToBottom();
}

// Search users
async function searchUsers(query) {
  if (!query) {
    fetchChattedUsers();
    return;
  }
  const res = await fetch(`/users/search?q=${encodeURIComponent(query)}`);
  users = await res.json();
  renderUserList(users);
}

// Render user list
function renderUserList(users) {
  userList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    
    // Create user info container
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    
    // Add username
    const username = document.createElement('div');
    username.className = 'username';
    username.textContent = user.username;
    userInfo.appendChild(username);
    
    // Add last message preview
    if (user.lastMessage) {
      const lastMessage = document.createElement('div');
      lastMessage.className = 'last-message';
      lastMessage.textContent = user.isLastMessageMine ? 
        `You: ${user.lastMessage}` : 
        user.lastMessage;
      userInfo.appendChild(lastMessage);
    }
    
    li.appendChild(userInfo);
    
    // Add unread badge if needed
    if (unreadCounts[user._id]) {
      const badge = document.createElement('span');
      badge.className = 'unread-badge';
      badge.textContent = unreadCounts[user._id];
      li.appendChild(badge);
    }
    
    if (selectedUser && selectedUser._id === user._id) {
      li.classList.add('selected');
    }
    
    li.onclick = () => selectUser(user);
    userList.appendChild(li);
  });
}

// Render messages
function renderMessages(msgs) {
  messages.innerHTML = '';
  msgs.forEach(msg => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${msg.senderName || msg.sender}:</strong> ${msg.content || msg.text}`;
    if ((msg.senderName && msg.senderName === CURRENT_USER) || (msg.sender === CURRENT_USER)) {
      item.className = 'sent';
    } else {
      item.className = 'received';
    }
    messages.appendChild(item);
  });
  scrollToBottom();
}

// Scroll to bottom of messages
function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

// Select a user to chat with and set unread count to 0
function selectUser(user) {
  selectedUser = user;
  renderUserList(users);
  fetchChatHistory(user._id);
  // Mark messages as read
  socket.emit('mark as read', { withUserId: user._id });
  unreadCounts[user._id] = 0;
}

// Handle sending a message
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value && selectedUser) {
    socket.emit('private message', { toUserId: selectedUser._id, text: input.value });
    input.value = '';
    // Fetch updated user list to get new order
    fetchChattedUsers();
  }
});

// Handle receiving a private message
socket.on('private message', async (msg) => {
  // If chat is open with sender or you are the sender, show message
  if (selectedUser && (msg.sender === selectedUser._id || msg.senderName === CURRENT_USER)) {
    if (!chatHistory[selectedUser._id]) chatHistory[selectedUser._id] = [];
    chatHistory[selectedUser._id].push(msg);
    renderMessages(chatHistory[selectedUser._id]);
  } else {
    // If chat is not open, update unread counts
    await fetchUnreadCounts();
  }

  // Fetch updated user list with correct order from server
  await fetchChattedUsers();
  scrollToBottom();
});

// Search bar event
searchInput.addEventListener('input', (e) => {
        searchUsers(e.target.value);
});

// Initial load
fetchChattedUsers();

// Handle logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/logout', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      // Disconnect socket
      socket.disconnect();
      // Redirect to login page
      window.location.href = '/login';
    } else {
      alert('Logout failed. Please try again.');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  }
});

socket.on('tokenExpired', () => {
  alert('Session expired or not logged in. Please log in again.');
  window.location.href = '/login';
});
    