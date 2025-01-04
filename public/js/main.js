document.addEventListener('DOMContentLoaded', async () => {
  const movieDropdown = document.getElementById('movie-dropdown');
  const playButton = document.getElementById('play-movie');
  const moviePlayer = document.getElementById('movie-player');
  const messageInput = document.getElementById('message-input');
  const sendMessageButton = document.getElementById('send-message');
  const messagesDiv = document.getElementById('messages');
  const startVoiceChatButton = document.getElementById('start-voice-chat');
  const stopVoiceChatButton = document.getElementById('stop-voice-chat');
  const localAudio = document.createElement('audio');  // For local audio (microphone)
  let localStream;
  let peerConnection;
  const socket = io();
  const roomName = 'movie-room';  // You can make this dynamic for different movie rooms

  // Join the chat room
  socket.emit('joinRoom', roomName);

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

  // Play the selected movie when the "Play Movie" button is clicked
  playButton.addEventListener('click', () => {
    const selectedMovieId = movieDropdown.value;
    if (selectedMovieId) {
      const movieUrl = `/play/${selectedMovieId}`;
      const movieSource = document.createElement('source');
      movieSource.src = movieUrl;
      movieSource.type = 'video/mp4';
      moviePlayer.innerHTML = ''; // Clear any previous source
      moviePlayer.appendChild(movieSource);
      moviePlayer.load();
      moviePlayer.play();
    }
  });

  // Send chat message to the server
  sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim()) {
      socket.emit('chatMessage', { room: roomName, message });
      messageInput.value = ''; // Clear input field
    }
  });

  // Receive messages from other users via socket.io
  socket.on('chatMessage', (message) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messagesDiv.appendChild(messageElement);
  });

  // Get user media (microphone)
  async function getUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream = stream;

    // Display local audio (optional, if you want to show it)
    localAudio.srcObject = localStream;
    localAudio.play();
  }

  // Handle incoming signaling messages for voice chat
  socket.on('signal', async (data) => {
    if (data.type === 'offer') {
      // Create a new peer connection
      peerConnection = new RTCPeerConnection();
      peerConnection.addStream(localStream);

      // Handle the incoming stream (from other peer)
      peerConnection.onaddstream = (event) => {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.stream;
        remoteAudio.play();
      };

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { type: 'answer', data: answer });
    }

    if (data.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
    }

    if (data.type === 'candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data));
    }
  });

  // Send ICE candidate when found
  function sendIceCandidate(candidate) {
    socket.emit('signal', { type: 'candidate', data: candidate });
  }

  // Start voice chat (make an offer)
  async function startVoiceChat() {
    peerConnection = new RTCPeerConnection();
    peerConnection.addStream(localStream);

    peerConnection.onaddstream = (event) => {
      const remoteAudio = document.createElement('audio');
      remoteAudio.srcObject = event.stream;
      remoteAudio.play();
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate(event.candidate);
      }
    };

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { type: 'offer', data: offer });

    // Show Stop Voice Chat button and hide Start Voice Chat button
    stopVoiceChatButton.style.display = 'inline-block';
    startVoiceChatButton.style.display = 'none';
  }

  // Stop voice chat (close peer connection and streams)
  function stopVoiceChat() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;

    // Hide Stop Voice Chat button and show Start Voice Chat button again
    stopVoiceChatButton.style.display = 'none';
    startVoiceChatButton.style.display = 'inline-block';
  }

  // Start voice chat when button is clicked
  startVoiceChatButton.addEventListener('click', async () => {
    await getUserMedia(); // Get user's audio stream
    startVoiceChat(); // Start the voice chat
  });

  // Stop voice chat when button is clicked
  stopVoiceChatButton.addEventListener('click', stopVoiceChat);
});
