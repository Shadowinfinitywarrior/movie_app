require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const axios = require('axios');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io'); // Import Socket.IO

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Set up WebSocket server
const PORT = process.env.PORT || 3000;

// Replace with your bot token and chat ID
const BOT_TOKEN = '7207667371:AAFYpBgHyGmgQhqANyzeVEUAN1Q5ZoWQBBI';  // Your bot token
const CHAT_ID = '5920561171'; // Your chat ID

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint to fetch movie list from Telegram bot
app.get('/movies', async (req, res) => {
  try {
    // Fetch updates from Telegram bot
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = response.data.result;

    // Extract movie documents (files) from the updates
    const movies = updates
      .filter(update => update.message && update.message.document)
      .map(update => ({
        file_id: update.message.document.file_id,
        file_name: update.message.document.file_name,
      }));

    res.json(movies);
  } catch (error) {
    console.error('Error fetching movies from Telegram:', error);
    res.status(500).send('Error fetching movies');
  }
});

// Endpoint to handle updates (like /start or other commands)
app.get('/updates', async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = response.data.result;

    // Process each update
    updates.forEach(update => {
      if (update.message && update.message.text === '/start') {
        const userId = update.message.from.id;
        const firstName = update.message.from.first_name;

        // Send a welcome message to the user when they use /start
        axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: userId,
          text: `Hello, ${firstName}! Welcome to the Movie Bot! Use /movies to see available movies.`,
        });

        console.log(`Start command received from ${firstName}`);
      }
    });

    res.json(updates);
  } catch (error) {
    console.error('Error fetching updates:', error);
    res.status(500).send('Error fetching updates');
  }
});

// Endpoint to play a selected movie
app.get('/play/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const fileResponse = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const filePath = fileResponse.data.result.file_path;

    // Construct file URL to stream the movie
    const fileURL = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    res.redirect(fileURL);  // Redirect to the movie URL
  } catch (error) {
    console.error('Error streaming movie:', error);
    res.status(500).send('Error streaming movie');
  }
});

// WebSocket signaling for WebRTC
io.on('connection', (socket) => {
  console.log('A user connected');

  // Room management: Join the chat room
  const roomName = 'movie-room';  // You can make this dynamic based on movie selection
  socket.join(roomName);
  console.log(`User joined room: ${roomName}`);

  // Handle chat messages
  socket.on('chatMessage', (data) => {
    io.to(roomName).emit('chatMessage', data.message);
  });

  // Handle WebRTC signaling messages
  socket.on('signal', (data) => {
    socket.broadcast.to(roomName).emit('signal', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the Express server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
