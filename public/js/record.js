/**
 * Voice Recording System for Saleté Sincère
 * Handles audio recording, form interactions, and submission
 */

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = null;
    this.recordingDuration = 0; // Track recording duration in milliseconds
    this.maxDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
    this.minDuration = 30 * 1000; // 30 seconds minimum (Phase 2)
    this.currentBlob = null;
    
    this.initializeElements();
    this.attachEventListeners();
  }

  initializeElements() {
    this.toggleBtn = document.getElementById('toggle-record');
    this.recordForm = document.getElementById('recording-form');
    this.recordBtn = document.getElementById('record-btn');
    this.recordText = this.recordBtn.querySelector('.record-text');
    this.audioPreview = document.getElementById('audio-preview');
    this.audioPlayer = document.getElementById('audio-player');
    this.submitBtn = document.getElementById('submit-btn');
    this.submitText = this.submitBtn.querySelector('.submit-text');
    this.cancelBtn = document.getElementById('cancel-btn');
    this.voiceForm = document.getElementById('voice-form');
    this.titleInput = document.getElementById('title');
    this.transcriptionInput = document.getElementById('transcription');
    this.badgeOptions = document.querySelectorAll('input[name="badge"]');
  }

  attachEventListeners() {
    this.toggleBtn.addEventListener('click', () => this.toggleForm());
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    this.cancelBtn.addEventListener('click', () => this.cancelRecording());
    this.voiceForm.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Badge selection visual feedback
    this.badgeOptions.forEach(radio => {
      radio.addEventListener('change', () => this.updateBadgeSelection());
    });
    
    // Form validation
    this.titleInput.addEventListener('input', () => this.validateForm());
    this.transcriptionInput.addEventListener('input', () => this.validateForm());
  }

  toggleForm() {
    const isHidden = this.recordForm.classList.contains('hidden');
    
    if (isHidden) {
      this.recordForm.classList.remove('hidden');
      this.toggleBtn.textContent = '− Fermer';
      this.toggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700', 'text-ivoire-sale');
      this.toggleBtn.classList.remove('bg-or-kintsugi', 'hover:bg-or-kintsugi-hover', 'text-noir-charbon');
    } else {
      this.recordForm.classList.add('hidden');
      this.toggleBtn.textContent = '+ Enregistrer votre histoire';
      this.toggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700', 'text-ivoire-sale');
      this.toggleBtn.classList.add('bg-or-kintsugi', 'hover:bg-or-kintsugi-hover', 'text-noir-charbon');
      this.resetForm();
    }
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.processRecording();
        stream.getTracks().forEach(track => track.stop());
      };
      
      this.audioChunks = [];
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      this.updateRecordingUI();
      this.startRecordingTimer();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showError('Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.recordingDuration = Date.now() - this.recordingStartTime;
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.updateRecordingUI();
    }
  }

  processRecording() {
    if (this.audioChunks.length > 0) {
      // Phase 2: Validate minimum duration (30 seconds)
      if (this.recordingDuration < this.minDuration) {
        const durationSeconds = Math.floor(this.recordingDuration / 1000);
        this.showError(`Enregistrement trop court (${durationSeconds}s), minimum 30 secondes`);
        this.resetRecording();
        return;
      }
      
      this.currentBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      const audioUrl = URL.createObjectURL(this.currentBlob);
      
      this.audioPlayer.src = audioUrl;
      this.audioPreview.classList.remove('hidden');
      this.validateForm();
      
      const durationSeconds = Math.floor(this.recordingDuration / 1000);
      console.log(`✅ Recording validated: ${durationSeconds}s (minimum 30s)`);
    }
  }

  updateRecordingUI() {
    if (this.isRecording) {
      this.recordText.textContent = 'Arrêter l\'enregistrement';
      this.recordBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
      this.recordBtn.classList.add('bg-gray-600', 'hover:bg-gray-700', 'animate-pulse');
    } else {
      this.recordText.textContent = 'Commencer l\'enregistrement';
      this.recordBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700', 'animate-pulse');
      this.recordBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    }
  }

  startRecordingTimer() {
    const timer = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(timer);
        return;
      }
      
      const elapsed = Date.now() - this.recordingStartTime;
      const remaining = this.maxDuration - elapsed;
      
      if (remaining <= 0) {
        this.stopRecording();
        clearInterval(timer);
        return;
      }
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this.recordText.textContent = `Arrêter (${minutes}:${seconds.toString().padStart(2, '0')})`;
    }, 1000);
  }

  updateBadgeSelection() {
    document.querySelectorAll('.badge-option').forEach(span => {
      span.classList.remove('ring-2', 'ring-or-kintsugi');
    });
    
    const selectedRadio = document.querySelector('input[name="badge"]:checked');
    if (selectedRadio) {
      const selectedSpan = selectedRadio.parentElement.querySelector('.badge-option');
      selectedSpan.classList.add('ring-2', 'ring-or-kintsugi');
    }
    
    this.validateForm();
  }

  validateForm() {
    const hasTitle = this.titleInput.value.trim().length > 0;
    const hasTranscription = this.transcriptionInput.value.trim().length > 0;
    const hasBadge = document.querySelector('input[name="badge"]:checked');
    const hasAudio = this.currentBlob !== null;
    
    const isValid = hasTitle && hasTranscription && hasBadge && hasAudio;
    
    this.submitBtn.disabled = !isValid;
  }

  async handleSubmit(event) {
    event.preventDefault();
    
    if (!this.currentBlob) {
      this.showError('Veuillez enregistrer votre histoire avant de l\'envoyer.');
      return;
    }
    
    this.setSubmitLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('title', this.titleInput.value.trim());
      formData.append('transcription', this.transcriptionInput.value.trim());
      formData.append('badge', document.querySelector('input[name="badge"]:checked').value);
      formData.append('audio', this.currentBlob, 'recording.webm');
      
      // Debug: log duration before appending
      console.log('🔍 CLIENT: Recording duration before append:', this.recordingDuration);
      console.log('🔍 CLIENT: Recording duration type:', typeof this.recordingDuration);
      
      formData.append('duration', this.recordingDuration.toString()); // Add duration for server validation
      
      // Debug: verify formData contents
      console.log('🔍 CLIENT: FormData entries:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }
      
      const response = await fetch('/api/posts', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.showSuccess('Votre histoire a été partagée avec succès !');
        this.resetForm();
        this.toggleForm();
        
        // Refresh the page to show the new post
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(result.message || 'Erreur inconnue');
      }
      
    } catch (error) {
      console.error('Error submitting form:', error);
      this.showError(`Erreur lors de l'envoi : ${error.message}`);
    } finally {
      this.setSubmitLoading(false);
    }
  }

  setSubmitLoading(loading) {
    this.submitBtn.disabled = loading;
    
    if (loading) {
      this.submitText.textContent = 'Envoi en cours...';
    } else {
      this.submitText.textContent = 'Partager votre histoire';
    }
  }

  resetForm() {
    this.voiceForm.reset();
    this.audioPreview.classList.add('hidden');
    this.audioPlayer.src = '';
    this.currentBlob = null;
    this.audioChunks = [];
    
    if (this.mediaRecorder && this.isRecording) {
      this.stopRecording();
    }
    
    // Reset badge selection visuals
    document.querySelectorAll('.badge-option').forEach(span => {
      span.classList.remove('ring-2', 'ring-or-kintsugi');
    });
    
    this.validateForm();
  }

  cancelRecording() {
    this.resetForm();
    this.toggleForm();
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50 ${
      type === 'error' 
        ? 'bg-red-600 text-white' 
        : type === 'success' 
          ? 'bg-green-600 text-white' 
          : 'bg-blue-600 text-white'
    }`;
    
    toast.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">${message}</span>
        <button type="button" class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
}

/**
 * Audio Player System for post playback
 */
class AudioPlayer {
  constructor() {
    this.currentAudio = null;
    this.currentButton = null;
    this.initializeAudioButtons();
  }

  initializeAudioButtons() {
    const audioButtons = document.querySelectorAll('.audio-play-btn');
    audioButtons.forEach(button => {
      button.addEventListener('click', (e) => this.handleAudioClick(e));
    });
  }

  async handleAudioClick(e) {
    e.preventDefault();
    const button = e.currentTarget;
    const audioUrl = button.dataset.audioUrl;

    // If clicking the same button that's already playing, pause it
    if (this.currentButton === button && this.currentAudio && !this.currentAudio.paused) {
      this.pauseAudio();
      return;
    }

    // Stop any currently playing audio
    if (this.currentAudio) {
      this.stopAudio();
    }

    try {
      await this.playAudio(audioUrl, button);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.showError('Impossible de lire l\'audio');
    }
  }

  async playAudio(audioUrl, button) {
    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);
      this.currentButton = button;

      this.currentAudio.addEventListener('loadstart', () => {
        this.setButtonState(button, 'loading');
      });

      this.currentAudio.addEventListener('canplay', () => {
        this.setButtonState(button, 'playing');
        this.currentAudio.play().then(resolve).catch(reject);
      });

      this.currentAudio.addEventListener('ended', () => {
        this.setButtonState(button, 'idle');
        this.currentAudio = null;
        this.currentButton = null;
      });

      this.currentAudio.addEventListener('error', () => {
        this.setButtonState(button, 'idle');
        reject(new Error('Audio loading failed'));
      });

      this.currentAudio.load();
    });
  }

  pauseAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.setButtonState(this.currentButton, 'paused');
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.setButtonState(this.currentButton, 'idle');
      this.currentAudio = null;
      this.currentButton = null;
    }
  }

  setButtonState(button, state) {
    const playIcon = button.querySelector('.play-icon');
    const pauseIcon = button.querySelector('.pause-icon');
    
    // Reset all states
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    button.classList.remove('animate-pulse');

    switch (state) {
      case 'loading':
        button.classList.add('animate-pulse');
        break;
      case 'playing':
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        break;
      case 'paused':
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        break;
      case 'idle':
      default:
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        break;
    }
  }

  showError(message) {
    // Reuse the toast system from VoiceRecorder
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 opacity-0 transform translate-y-2 transition-all duration-300';
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-y-2');
    });
    
    toast.innerHTML = `
      <div class="flex items-center">
        <span class="text-sm font-medium">${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check for MediaRecorder support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('MediaRecorder API not supported');
    return;
  }
  
  // Initialize voice recorder
  new VoiceRecorder();
  
  // Initialize audio player for post playback
  new AudioPlayer();
  
  // Initialize vote system
  initVoteSystem();
});

// Vote system
function initVoteSystem() {
  document.querySelectorAll('button[data-post-id]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const postId = button.dataset.postId;
      const voteSpan = button.querySelector('span');
      
      if (!voteSpan) {
        console.error('Vote span not found');
        return;
      }
      
      // Disable button during request
      button.disabled = true;
      button.classList.add('opacity-50');
      
      try {
        const response = await fetch(`/api/posts/${postId}/vote`, {
          method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          voteSpan.textContent = `+${result.data.votes}`;
          button.classList.add('text-green-500');
          
          // Show success feedback
          showVoteNotification('Vote ajouté !', 'success');
        } else {
          showVoteNotification(result.message || 'Erreur lors du vote', 'error');
        }
      } catch (error) {
        console.error('Vote error:', error);
        showVoteNotification('Erreur lors du vote', 'error');
      } finally {
        // Re-enable button after a short delay
        setTimeout(() => {
          button.disabled = false;
          button.classList.remove('opacity-50');
        }, 1000);
      }
    });
  });
}

function showVoteNotification(message, type) {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 max-w-sm p-3 rounded-lg shadow-lg z-50 ${
    type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
  }`;
  
  toast.innerHTML = `
    <div class="flex items-center">
      <span class="text-sm font-medium">${message}</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
}
