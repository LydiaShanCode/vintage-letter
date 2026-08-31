import './style.css';

// Configuration
const PHOTOS = [
  '/photos/01-cafe-selfie.jpg',
  '/photos/02-cloud-ceiling.jpg',
  '/photos/03-facetime.png',
  '/photos/04-night-citi.jpg',
  '/photos/05-photobooth.jpg',
];

const LETTER_FILE = '/letter.txt';

// Writing speed configuration (milliseconds per character)
const BASE_SPEED = 45;
const SPEED_VARIANCE = 25;
const PAUSE_AFTER_PUNCTUATION = {
  '.': 400,
  '!': 400,
  '?': 400,
  ',': 200,
  ';': 250,
  ':': 250,
  '\n': 300,
};

// State
let letterText = '';
let writingComplete = false;
let isPeeling = false;

// Initialize the experience
async function init() {
  createCollage();
  await loadLetter();
  addGrainOverlay();
  
  // Wait a moment for the scene to settle, then start writing
  setTimeout(() => {
    startWriting();
  }, 800);
  
  // Set up peel interaction after writing completes
  setupPeelInteraction();
}

// Create the photo collage background
function createCollage() {
  const collage = document.getElementById('collage');
  
  // Photo configurations (position, rotation, size)
  const photoConfigs = [
    { photo: PHOTOS[0], left: '5%', top: '8%', width: '35%', rotate: -4 },
    { photo: PHOTOS[1], right: '8%', top: '5%', width: '38%', rotate: 3 },
    { photo: PHOTOS[2], left: '10%', bottom: '15%', width: '32%', rotate: 2 },
    { photo: PHOTOS[3], right: '5%', bottom: '20%', width: '30%', rotate: -3 },
    { photo: PHOTOS[4], left: '35%', top: '35%', width: '28%', rotate: -2 },
  ];
  
  photoConfigs.forEach((config, index) => {
    const photo = document.createElement('div');
    photo.className = 'photo';
    photo.style.backgroundImage = `url(${config.photo})`;
    photo.style.width = config.width;
    photo.style.aspectRatio = '4/5';
    photo.style.transform = `rotate(${config.rotate}deg)`;
    
    if (config.left) photo.style.left = config.left;
    if (config.right) photo.style.right = config.right;
    if (config.top) photo.style.top = config.top;
    if (config.bottom) photo.style.bottom = config.bottom;
    
    collage.appendChild(photo);
    
    // Add washi tape over some photos
    if (index % 2 === 0) {
      const tape = createTape(config);
      collage.appendChild(tape);
    }
  });
}

// Create washi tape element
function createTape(photoConfig) {
  const tape = document.createElement('div');
  tape.className = 'tape';
  
  const isHorizontal = Math.random() > 0.5;
  
  if (isHorizontal) {
    tape.style.width = '40%';
    tape.style.height = '20px';
    tape.style.left = photoConfig.left || 'auto';
    tape.style.right = photoConfig.right || 'auto';
    tape.style.top = photoConfig.top ? `calc(${photoConfig.top} + 5%)` : 'auto';
  } else {
    tape.style.width = '20px';
    tape.style.height = '30%';
    tape.style.left = photoConfig.left ? `calc(${photoConfig.left} + 2%)` : 'auto';
    tape.style.right = photoConfig.right ? `calc(${photoConfig.right} + 2%)` : 'auto';
    tape.style.top = photoConfig.top || 'auto';
  }
  
  tape.style.transform = `rotate(${(Math.random() - 0.5) * 8}deg)`;
  
  return tape;
}

// Load letter text from file
async function loadLetter() {
  try {
    const response = await fetch(LETTER_FILE);
    letterText = await response.text();
  } catch (error) {
    console.error('Failed to load letter:', error);
    // Fallback letter if file can't be loaded
    letterText = `My dearest,\n\nThis letter finds you where you are.\n\nYours always`;
  }
}

// Animate the letter being written
async function startWriting() {
  const letterContent = document.getElementById('letter-content');
  let currentIndex = 0;
  
  // Create cursor element
  const cursor = document.createElement('span');
  cursor.className = 'writing-cursor';
  
  async function writeNextCharacter() {
    if (currentIndex >= letterText.length) {
      // Writing complete
      cursor.remove();
      writingComplete = true;
      showPeelCorner();
      return;
    }
    
    const char = letterText[currentIndex];
    
    // Add character to the content
    const textNode = document.createTextNode(char);
    letterContent.appendChild(textNode);
    letterContent.appendChild(cursor);
    
    // Scroll to keep cursor in view
    cursor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    currentIndex++;
    
    // Calculate delay until next character
    let delay = BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIANCE;
    
    // Add pause after punctuation
    if (PAUSE_AFTER_PUNCTUATION[char]) {
      delay += PAUSE_AFTER_PUNCTUATION[char];
    }
    
    // Occasionally add a small thinking pause
    if (Math.random() < 0.05) {
      delay += Math.random() * 300;
    }
    
    setTimeout(writeNextCharacter, delay);
  }
  
  writeNextCharacter();
}

// Show the peel corner affordance
function showPeelCorner() {
  const corner = document.querySelector('.peel-corner');
  setTimeout(() => {
    corner.classList.add('visible');
  }, 1000);
}

// Set up the vellum peel interaction
function setupPeelInteraction() {
  const vellum = document.getElementById('vellum');
  const corner = document.querySelector('.peel-corner');
  let touchStartY = 0;
  let touchStartX = 0;
  let isPeeled = false;
  
  // Touch/mouse handlers for the corner
  const startPeel = (e) => {
    if (!writingComplete) return;
    
    isPeeling = true;
    corner.classList.add('active');
    vellum.classList.add('peeling');
    
    if (e.type === 'touchstart') {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }
  };
  
  const continuePeel = (e) => {
    if (!isPeeling) return;
    
    let deltaY = 0;
    let deltaX = 0;
    
    if (e.type === 'touchmove') {
      e.preventDefault();
      deltaY = touchStartY - e.touches[0].clientY;
      deltaX = e.touches[0].clientX - touchStartX;
    }
    
    // If dragged up/right enough, lift the vellum
    if (deltaY > 60 || deltaX > 60) {
      liftVellum();
    }
  };
  
  const endPeel = () => {
    if (!isPeeling) return;
    
    isPeeling = false;
    corner.classList.remove('active');
    
    if (!isPeeled) {
      vellum.classList.remove('peeling');
    }
  };
  
  const liftVellum = () => {
    if (isPeeled) {
      // Put it back down
      vellum.classList.remove('lifted');
      vellum.classList.add('peeling');
      document.body.classList.remove('vellum-peeled');
      isPeeled = false;
      setTimeout(() => {
        vellum.classList.remove('peeling');
      }, 100);
    } else {
      // Lift it up
      vellum.classList.remove('peeling');
      vellum.classList.add('lifted');
      document.body.classList.add('vellum-peeled');
      isPeeled = true;
    }
    isPeeling = false;
    corner.classList.remove('active');
  };
  
  // Mouse events
  corner.addEventListener('mousedown', startPeel);
  document.addEventListener('mousemove', continuePeel);
  document.addEventListener('mouseup', endPeel);
  
  // Touch events
  corner.addEventListener('touchstart', startPeel, { passive: false });
  document.addEventListener('touchmove', continuePeel, { passive: false });
  document.addEventListener('touchend', endPeel);
  
  // Click/tap to toggle
  corner.addEventListener('click', (e) => {
    if (!writingComplete) return;
    e.stopPropagation();
    liftVellum();
  });
}

// Add film grain overlay
function addGrainOverlay() {
  const grain = document.createElement('div');
  grain.className = 'grain';
  document.body.appendChild(grain);
}

// Handle first interaction to start animation (for browsers that block autoplay)
let hasInteracted = false;
document.addEventListener('touchstart', () => {
  if (!hasInteracted && !writingComplete) {
    hasInteracted = true;
  }
}, { once: true, passive: true });

// Start the experience
init();