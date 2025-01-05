document.addEventListener('DOMContentLoaded', async () => {
  // Get elements
  const movieDropdown = document.getElementById('movie-dropdown');
  const playButton = document.getElementById('play-movie');
  const moviePlayer = document.getElementById('movie-player');
  const messageInput = document.getElementById('message-input');
  const sendMessageButton = document.getElementById('send-message');
  const messagesDiv = document.getElementById('messages');
  const clearChatButton = document.getElementById('clear-chat');
  const startScreenShareButton = document.getElementById('screen-share-button');
  const stopScreenShareButton = document.getElementById('stop-screen-share');
  const screenShareVideo = document.getElementById('screen-share-video');

  let peerConnection;
  let screenStream; // For screen sharing
  const username = prompt("Enter your username:");
  const socket = io();
  let currentRoom = 'movie-room'; // Default room

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

  // Disable play button until a movie is selected
  playButton.disabled = !movieDropdown.value;

  // Enable or disable play button based on selection
  movieDropdown.addEventListener('change', () => {
    playButton.disabled = !movieDropdown.value;
  });

  // Play the selected movie
  playButton.addEventListener('click', () => {
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

  // Screen sharing logic
  async function startScreenShare() {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always", height: 1000, width: 1200 },
        audio: false
      });
      screenShareVideo.srcObject = screenStream; // Display the screen stream in the local video

      peerConnection = new RTCPeerConnection();
      screenStream.getTracks().forEach(track => peerConnection.addTrack(track, screenStream));

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) sendIceCandidate(event.candidate);
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal', { type: 'offer', data: offer });

      startScreenShareButton.style.display = 'none';
      stopScreenShareButton.style.display = 'inline-block';
    } catch (err) {
      console.error('Error starting screen share:', err);
      alert('Could not start screen sharing. Make sure you are using a supported browser.');
    }
  }

  function stopScreenShare() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }

    startScreenShareButton.style.display = 'inline-block';
    stopScreenShareButton.style.display = 'none';
    screenShareVideo.srcObject = null; // Clear screen share video
  }

  startScreenShareButton.addEventListener('click', startScreenShare);
  stopScreenShareButton.addEventListener('click', stopScreenShare);

  // Log screen-sharing options
  function logScreenShareInfo() {
    const videoTrack = screenShareVideo.srcObject?.getVideoTracks()[0];
    if (videoTrack) {
      console.info("Track settings:", videoTrack.getSettings());
      console.info("Track constraints:", videoTrack.getConstraints());
    }
  }
});
