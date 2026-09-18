/**
 * LPU Touch - Mess Food Scanner Web App
 * Real-time navigation, camera QR scanning, countdown timers, and audio feedback
 */

// Application State
const state = {
  currentView: 'dashboard',
  selectedMeal: 'Dinner',
  assignedMess: 'Mess BS-13',
  countdownSeconds: 30,
  countdownInterval: null,
  cameraStream: null,
  isScanning: false,
  animationFrameId: null
};

// DOM Elements
const views = {
  dashboard: document.getElementById('view-dashboard'),
  coupon: document.getElementById('view-coupon'),
  scanner: document.getElementById('view-scanner'),
  pass: document.getElementById('view-pass')
};

// Audio Feedback using Web Audio API
function playScanChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Pleasant double-beep confirmation sound
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.28);
    gain2.gain.setValueAtTime(0.25, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.28);

    if (navigator.vibrate) {
      navigator.vibrate(150);
    }
  } catch (e) {
    console.log('Audio feedback not permitted:', e);
  }
}

// Show specific view with transition
function navigateTo(viewName) {
  // Teardown previous view
  if (state.currentView === 'scanner' && viewName !== 'scanner') {
    stopCamera();
  }
  if (state.currentView === 'pass' && viewName !== 'pass') {
    stopCountdown();
  }

  // Update classes
  Object.keys(views).forEach(name => {
    if (views[name]) {
      if (name === viewName) {
        views[name].classList.add('active');
      } else {
        views[name].classList.remove('active');
      }
    }
  });

  state.currentView = viewName;

  // Setup new view
  if (viewName === 'scanner') {
    startCamera();
  } else if (viewName === 'pass') {
    updatePassScreen();
    startCountdown();
  }
}

function checkInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const hash = window.location.hash.replace('#', '');
  const target = viewParam || hash;
  if (['dashboard', 'coupon', 'scanner', 'pass'].includes(target)) {
    navigateTo(target);
  }
  if (params.get('scroll') === 'bottom') {
    setTimeout(() => {
      const container = document.querySelector('.pass-sheet-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 300);
  }
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (['dashboard', 'coupon', 'scanner', 'pass'].includes(hash)) {
    navigateTo(hash);
  }
});

// ==========================================
// CAMERA & QR SCANNING
// ==========================================
const videoElem = document.getElementById('scanner-video');
const canvasElem = document.getElementById('scanner-canvas');
const canvasCtx = canvasElem ? canvasElem.getContext('2d', { willReadFrequently: true }) : null;

async function startCamera() {
  state.isScanning = true;
  const viewport = document.getElementById('scanner-viewport-box');

  // Set fallback image by default
  if (viewport) {
    viewport.style.backgroundImage = "url('assets/scanner_bg.jpg')";
  }

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      state.cameraStream = stream;
      if (videoElem) {
        videoElem.srcObject = stream;
        videoElem.setAttribute('playsinline', true);
        await videoElem.play();
        // Camera feed is active, remove fallback background image
        if (viewport) {
          viewport.style.backgroundImage = 'none';
        }
        requestAnimationFrame(tickScanner);
      }
    }
  } catch (err) {
    console.log('Camera access unavailable or declined, using realistic camera overlay:', err);
    // User can still scan with the instant test button or click anywhere on viewfinder
  }
}

function stopCamera() {
  state.isScanning = false;
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
  }
  if (videoElem) {
    videoElem.srcObject = null;
  }
}

function tickScanner() {
  if (!state.isScanning) return;

  if (videoElem && videoElem.readyState === videoElem.HAVE_ENOUGH_DATA && canvasCtx && canvasElem) {
    canvasElem.height = videoElem.videoHeight;
    canvasElem.width = videoElem.videoWidth;
    canvasCtx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
    
    const imageData = canvasCtx.getImageData(0, 0, canvasElem.width, canvasElem.height);
    
    // Use jsQR if available
    if (window.jsQR) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      if (code && code.data) {
        console.log('QR Code scanned successfully:', code.data);
        handleSuccessfulScan();
        return;
      }
    }
  }

  state.animationFrameId = requestAnimationFrame(tickScanner);
}

function handleSuccessfulScan() {
  if (!state.isScanning) return;
  state.isScanning = false;
  playScanChime();
  
  // Flash scan line or screen feedback
  const scanLine = document.querySelector('.scanner-laser-line');
  if (scanLine) {
    scanLine.style.boxShadow = '0 0 25px #00ff66, 0 0 35px #00ff66';
    scanLine.style.background = '#00ff66';
  }

  setTimeout(() => {
    navigateTo('pass');
    if (scanLine) {
      scanLine.style.boxShadow = '';
      scanLine.style.background = '';
    }
  }, 400);
}

// ==========================================
// MESS PASS & COUNTDOWN
// ==========================================
function updatePassScreen() {
  // Update meal name on the right card
  const mealElem = document.getElementById('pass-meal-type');
  if (mealElem) {
    mealElem.textContent = state.selectedMeal;
  }

  // Live current date & time in exact format: MMM DD, YYYY and hh:mm A
  const dateElem = document.getElementById('pass-date');
  const timeElem = document.getElementById('pass-time');

  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[now.getMonth()];
  const dayStr = String(now.getDate()).padStart(2, '0');
  const yearStr = now.getFullYear();
  if (dateElem) dateElem.textContent = `${monthStr} ${dayStr}, ${yearStr}`;

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  if (timeElem) timeElem.textContent = `${hoursStr}:${minutes} ${ampm}`;
}

function startCountdown() {
  stopCountdown();
   // 30 second counter
  const badge = document.getElementById('pass-countdown-number');
  if (badge) badge.textContent = state.countdownSeconds;

  state.countdownInterval = setInterval(() => {
    state.countdownSeconds--;
    if (badge) {
      badge.textContent = state.countdownSeconds;
    }
    if (state.countdownSeconds <= 0) {
      stopCountdown();
      showToast('Pass expired');
      navigateTo('coupon');
    }
  }, 1000);
}

function stopCountdown() {
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
}

// Toast notification for user actions
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      z-index: 999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    `;
    document.querySelector('.device-container').appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2200);
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Mess Food Scanner tile click
  const messTile = document.getElementById('tile-mess-food-scanner');
  if (messTile) {
    messTile.addEventListener('click', () => {
      navigateTo('coupon');
    });
  }

  // Mess Coupon back button -> Dashboard
  const couponBackBtn = document.getElementById('coupon-back-btn');
  if (couponBackBtn) {
    couponBackBtn.addEventListener('click', () => {
      navigateTo('dashboard');
    });
  }

  // Meal buttons -> Scanner
  const btnBreakfast = document.getElementById('btn-meal-breakfast');
  if (btnBreakfast) {
    btnBreakfast.addEventListener('click', () => {
      state.selectedMeal = 'Breakfast';
      navigateTo('scanner');
    });
  }

  const btnDinner = document.getElementById('btn-meal-dinner');
  if (btnDinner) {
    btnDinner.addEventListener('click', () => {
      state.selectedMeal = 'Dinner';
      navigateTo('scanner');
    });
  }

  // Scanner back button -> Mess Coupon
  const scannerBackBtn = document.getElementById('scanner-back-btn');
  if (scannerBackBtn) {
    scannerBackBtn.addEventListener('click', () => {
      navigateTo('coupon');
    });
  }

  // Instant simulate scan button
  const instantScanBtn = document.getElementById('btn-instant-scan');
  if (instantScanBtn) {
    instantScanBtn.addEventListener('click', () => {
      handleSuccessfulScan();
    });
  }

  // Also tapping the reticle box triggers instant scan
  const cutoutBox = document.querySelector('.scanner-cutout-box');
  if (cutoutBox) {
    cutoutBox.style.pointerEvents = 'auto';
    cutoutBox.style.cursor = 'pointer';
    cutoutBox.addEventListener('click', () => {
      handleSuccessfulScan();
    });
  }

  // Pass close button -> Mess Coupon
  const passCloseBtn = document.getElementById('pass-close-btn');
  if (passCloseBtn) {
    passCloseBtn.addEventListener('click', () => {
      navigateTo('coupon');
    });
  }

  // Toggle live / fixed time by tapping datetime row
  const datetimeRow = document.querySelector('.pass-datetime-row');
  if (datetimeRow) {
    datetimeRow.style.cursor = 'pointer';
    datetimeRow.addEventListener('click', () => {
      state.useLiveTime = !state.useLiveTime;
      updatePassScreen();
      showToast(state.useLiveTime ? 'Switched to Live Clock' : 'Switched to Aug 25, 2026');
    });
  }

  // Rate Us buttons
  document.querySelectorAll('.rate-us-btn, .pass-rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Thank you for your rating! ★★★★★');
    });
  });

  // Bottom Navigation tab clicking
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const tabName = item.getAttribute('data-tab');
      if (tabName !== 'dashboard') {
        showToast(`${item.querySelector('span').textContent} section`);
      }
    });
  });

  // Tile clicks on Dashboard
  document.querySelectorAll('.menu-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      if (tile.id !== 'tile-mess-food-scanner') {
        const title = tile.querySelector('.tile-pill').textContent.trim();
        showToast(`Opened ${title}`);
      }
    });
  });

  // Add more tiles button
  const addTileBtn = document.querySelector('.add-tile-btn');
  if (addTileBtn) {
    addTileBtn.addEventListener('click', () => {
      showToast('Add menu grids feature');
    });
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('SW registration error:', err);
      });
    });
  }

  // PWA Install Prompt Event
  let deferredPrompt = null;
  const pwaBtn = document.getElementById('pwa-install-btn');
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaBtn) pwaBtn.style.display = 'inline-flex';
  });

  if (pwaBtn) {
    // Display install prompt button if not already running in standalone mode
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      pwaBtn.style.display = 'inline-flex';
    }
    pwaBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaBtn.style.display = 'none';
        }
        deferredPrompt = null;
      } else {
        showToast('To install: tap browser menu (⋮ / Share) -> Add to Home Screen');
      }
    });
  }

  // Check initial route (via URL query param ?view= or #hash)
  checkInitialRoute();
});
