require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const axios = require('axios');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io'); // Import Socket.IO
const multer = require('multer'); // Import multer for file uploads
const fs = require('fs');
const formData = require('form-data');

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Set up WebSocket server
const PORT = process.env.PORT || 3000;

// Replace with your bot token and chat ID
const BOT_TOKEN = process.env.BOT_TOKEN || '7207667371:AAFYpBgHyGmgQhqANyzeVEUAN1Q5ZoWQBBI';
const CHAT_ID = process.env.CHAT_ID || '5920561171';

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Endpoint to fetch movie list from Telegram bot
app.get('/movies', async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = response.data.result;

    const movies = updates
      .filter(update => update.message && update.message.document)
      .map(update => ({
        file_id: update.message.document.file_id,
        file_name: update.message.document.file_name,
      }));

    res.json(movies);
  } catch (error) {
    console.error('Error fetching movies from Telegram:', error.message);
    res.status(500).send('Error fetching movies');
  }
});

// Endpoint to handle updates (like /start or other commands)
app.get('/updates', async (req, res) => {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
    const updates = response.data.result;

    updates.forEach(update => {
      if (update.message && update.message.text === '/start') {
        const userId = update.message.from.id;
        const firstName = update.message.from.first_name;

        axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: userId,
          text: `Hello, ${firstName}! Welcome to the Movie Bot! Use /movies to see available movies.`,
        });

        console.log(`Start command received from ${firstName}`);
      }
    });

    res.json(updates);
  } catch (error) {
    console.error('Error fetching updates:', error.message);
    res.status(500).send('Error fetching updates');
  }
});

// Endpoint to upload a video file and send it to the Telegram bot with progress tracking
app.post('/upload', upload.single('video'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send('No file uploaded');
  }

  const form = new formData();
  form.append('chat_id', CHAT_ID);
  form.append('document', fs.createReadStream(path.join(__dirname, '../uploads', file.filename)));

  try {
    let uploadedBytes = 0;
    const totalBytes = file.size;

    form.getLength((err, length) => {
      if (err) {
        console.error('Error calculating form length:', err);
        return res.status(500).send('Error calculating form length');
      }

      axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
        form,
        {
          headers: form.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.lengthComputable) {
              uploadedBytes = progressEvent.loaded;
              const percent = Math.round((uploadedBytes / totalBytes) * 100);
              io.emit('uploadProgress', { percent });
            }
          }
        }
      )
      .then(response => {
        res.status(200).send('File uploaded to Telegram successfully');
      })
      .catch(error => {
        console.error('Error uploading file to Telegram:', error.message);
        res.status(500).send('Error uploading file to Telegram');
      });
    });
  } catch (error) {
    console.error('Error during file upload:', error.message);
    res.status(500).send('Error uploading file');
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

    const fileURL = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    res.redirect(fileURL); 
  } catch (error) {
    console.error('Error streaming movie:', error.message);
    res.status(500).send('Error streaming movie');
  }
});

// WebSocket signaling for WebRTC (includes screen sharing)
io.on('connection', (socket) => {
  console.log('A user connected');

  const roomName = 'movie-room'; 
  socket.join(roomName);
  console.log(`User joined room: ${roomName}`);

  // Handle chat messages
  socket.on('chatMessage', (data) => {
    io.to(roomName).emit('chatMessage', {
      username: data.username || 'Anonymous',
      message: data.message,
    });
  });

  // Handle WebRTC signaling messages
  socket.on('signal', (data) => {
    socket.broadcast.to(roomName).emit('signal', data);
  });

  // Handle screen sharing stream
  socket.on('screenShare', (data) => {
    socket.broadcast.to(roomName).emit('screenShare', data);
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
