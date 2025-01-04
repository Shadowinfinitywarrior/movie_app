document.addEventListener('DOMContentLoaded', async () => {
  const movieDropdown = document.getElementById('movie-dropdown');
  const playButton = document.getElementById('play-movie');
  const moviePlayer = document.getElementById('movie-player');
  const messageInput = document.getElementById('message-input');
  const sendMessageButton = document.getElementById('send-message');
  const messagesDiv = document.getElementById('messages');
  const clearChatButton = document.getElementById('clear-chat');
  const startVoiceChatButton = document.getElementById('start-voice-chat');
  const stopVoiceChatButton = document.getElementById('stop-voice-chat');
  const voiceChatContainer = document.getElementById('voice-chat-container');
  const localAudio = document.createElement('audio'); // For local audio
  let localStream;
  let peerConnection;
  const username = prompt("Enter your username:");
  const socket = io();
  const roomName = 'movie-room'; // Dynamic room logic can be added here

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
      socket.emit('chatMessage', { room: roomName, username, message });
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
    messagesDiv.innerHTML = '';
  });

  // Voice chat logic
  async function getUserMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream = stream;
    localAudio.srcObject = localStream;
    localAudio.play();
  }

  function sendIceCandidate(candidate) {
    socket.emit('signal', { type: 'candidate', data: candidate });
  }

  async function startVoiceChat() {
    await getUserMedia();
    peerConnection = new RTCPeerConnection();
    peerConnection.addStream(localStream);

    peerConnection.onaddstream = (event) => {
      const remoteAudio = document.createElement('audio');
      remoteAudio.srcObject = event.stream;
      remoteAudio.autoplay = true;
      voiceChatContainer.appendChild(remoteAudio);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) sendIceCandidate(event.candidate);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { type: 'offer', data: offer });

    startVoiceChatButton.style.display = 'none';
    stopVoiceChatButton.style.display = 'inline-block';
  }

  function stopVoiceChat() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }

    startVoiceChatButton.style.display = 'inline-block';
    stopVoiceChatButton.style.display = 'none';
    voiceChatContainer.innerHTML = ''; // Clear remote streams
  }

  startVoiceChatButton.addEventListener('click', startVoiceChat);
  stopVoiceChatButton.addEventListener('click', stopVoiceChat);

  socket.on('signal', async (data) => {
    if (data.type === 'offer') {
      await getUserMedia();
      peerConnection = new RTCPeerConnection();
      peerConnection.addStream(localStream);

      peerConnection.onaddstream = (event) => {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.stream;
        remoteAudio.autoplay = true;
        voiceChatContainer.appendChild(remoteAudio);
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) sendIceCandidate(event.candidate);
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { type: 'answer', data: answer });
    } else if (data.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.data));
    } else if (data.type === 'candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.data));
    }
  });
});
