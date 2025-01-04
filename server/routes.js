const express = require('express');
const axios = require('axios');
const router = express.Router();

// Replace with your bot token and chat ID
const BOT_TOKEN = '7207667371:AAFYpBgHyGmgQhqANyzeVEUAN1Q5ZoWQBBI';  // Your bot token

// Route to fetch the list of movies from the Telegram bot
router.get('/movies', async (req, res) => {
  try {
    // Fetch updates from the Telegram bot
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

// Route to play a selected movie by file ID
router.get('/play/:fileId', async (req, res) => {
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

// Root route (already defined in your existing code)
router.get('/', (req, res) => {
  res.send('Welcome to the Movie App');
});

module.exports = router;
