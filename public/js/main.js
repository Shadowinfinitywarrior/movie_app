document.addEventListener('DOMContentLoaded', async () => {
  const movieDropdown = document.getElementById('movie-dropdown');
  const playButton = document.getElementById('play-movie');
  const moviePlayer = document.getElementById('movie-player');
  const messageInput = document.getElementById('message-input');
  const sendMessageButton = document.getElementById('send-message');
  const messagesDiv = document.getElementById('messages');
  const clearChatButton = document.getElementById('clear-chat');
  const uploadStatusContainer = document.getElementById('upload-status-container');
  const uploadProgress = document.getElementById('upload-progress');
  const uploadPercentage = document.getElementById('upload-percentage');
  
  const username = prompt("Enter your username:");
  const socket = io();
  let currentRoom = 'movie-room'; // Default room

  // Only allow the Admin1456 to control video playback
  const isAdmin = username === 'Admin1456';

  // Join the chat room
  socket.emit('joinRoom', currentRoom);

  // Fetch the list of movies from the server
  const response = await fetch('/movies');
  const movies = await response.json();

  // Populate the dropdown with movies
  movies.forEach(movie => {
    const option = document.createElement('option');
    option.value = movie.file_id;
    option.textContent = movie.file_name;
    movieDropdown.appendChild(option);
  });

  // Disable play button if the user is not Admin
  playButton.disabled = !isAdmin || !movieDropdown.value;

  // Enable or disable play button based on selection (and user role)
  movieDropdown.addEventListener('change', () => {
    playButton.disabled = !isAdmin || !movieDropdown.value;
  });

  // Play the selected movie (only if the user is Admin)
  playButton.addEventListener('click', () => {
    if (isAdmin) {
      const selectedMovieId = movieDropdown.value;
      if (selectedMovieId) {
        const movieUrl = `/play/${selectedMovieId}`;
        const movieSource = document.createElement('source');
        movieSource.src = movieUrl;
        movieSource.type = 'video/mp4';
        moviePlayer.innerHTML = ''; // Clear previous source
        moviePlayer.appendChild(movieSource);
        moviePlayer.load();
        moviePlayer.play();
      }
    } else {
      alert('You do not have permission to play the video.');
    }
  });

  // Send chat message
  sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim()) {
      socket.emit('chatMessage', { room: currentRoom, username, message });
      messageInput.value = ''; // Clear input
    }
  });

  // Receive chat messages
  socket.on('chatMessage', (data) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${data.username}: ${data.message}`;
    messagesDiv.appendChild(messageElement);
  });

  // Clear chat messages
  clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear the chat?")) {
      messagesDiv.innerHTML = '';
    }
  });

  // Upload a movie to Telegram and show progress
  async function uploadMovieToTelegram(movieFile) {
    const formData = new FormData();
    formData.append('document', movieFile);

    uploadStatusContainer.style.display = 'block'; // Show the progress bar
    uploadProgress.value = 0; // Reset progress

    try {
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            uploadProgress.value = percent;
            uploadPercentage.textContent = `${percent}%`;
          }
        },
      });

      if (response.status === 200) {
        alert('Movie uploaded successfully!');

        // Assuming response contains movie file info (name and file_id or URL)
        const uploadedMovie = response.data; // Adjust according to your backend response

        // Add the new movie to the dropdown
        const option = document.createElement('option');
        option.value = uploadedMovie.file_id; // or uploadedMovie.file_url
        option.textContent = uploadedMovie.file_name;
        movieDropdown.appendChild(option);

        // Enable the play button now that a movie is available
        playButton.disabled = !isAdmin || !movieDropdown.value;
      } else {
        throw new Error('Failed to upload movie');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload the movie.');
    } finally {
      uploadStatusContainer.style.display = 'none'; // Hide the progress bar
    }
  }

  // Handle file input and upload
  const videoFileInput = document.getElementById('video-file');
  videoFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadMovieToTelegram(file);
    }
  });
});
