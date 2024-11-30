const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Game constants
const BUBBLE_SIZE = 40;
const FISH_SPAWN_CHANCE = 0.02;  // Regular fish spawn rate
const POISON_FISH_CHANCE = 0.3;   // 30% chance for poison fish
const RARE_FISH_CHANCE = 0.2;   // ~6.7% chance (roughly 1 in 15) for rare fish
const NORMAL_ESCAPE_CHANCE = 0.85; // 85% escape chance for normal fish
const RARE_ESCAPE_CHANCE = 0.1;   // 10% escape chance for rare fish

// Fish types
const FISH_TYPES = {
    NORMAL: 'normal',
    POISON: 'poison',
    RARE: 'rare'
};

// Game state variables
let score = 0;
let timeLeft = 60;
let gameStarted = false;
let gameActive = false;
let mouseX = 0;
let mouseY = 0;
let gameLoopRunning = false;
let lives = 3;
let highScore = 0;
let particles = [];
let ripples = [];
let comboTimer = 0;
let comboMultiplier = 1;
let lastCatchTime = 0;
let timeBonusActive = false;
let timeBonusDuration = 0;
const TIME_BONUS_MAX_DURATION = 60;

// Simplify sounds
const SOUNDS = {
    // Sound effects from URLs
    bubble: new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3'),
    gameOver: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
    poison: new Audio('https://assets.mixkit.co/active_storage/sfx/583/583-preview.mp3'),
    rare: new Audio('https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3'), // Special sound for rare fish
    // Background music from local storage
    bgMusic: new Audio('music/mixkit-games-worldbeat-466.mp3')
};

// Function to handle background music loading
function initBackgroundMusic() {
    console.log('Initializing background music...');
    SOUNDS.bgMusic.addEventListener('canplaythrough', () => {
        console.log('Background music loaded successfully');
    });
    
    SOUNDS.bgMusic.addEventListener('error', (e) => {
        console.error('Background music error:', e);
        // Try alternative music if main fails
        for (let musicUrl of ALTERNATIVE_BG_MUSIC) {
            try {
                console.log('Trying alternative music:', musicUrl);
                SOUNDS.bgMusic = new Audio(musicUrl);
                SOUNDS.bgMusic.loop = true;
                SOUNDS.bgMusic.volume = 0.5;
                break;
            } catch(e) {
                console.error('Alternative music failed:', e);
            }
        }
    });
}

// Add sound restart function
function restartSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(error => {
        console.log('Sound play failed:', error);
    });
}

// Fish class (simplified)
class Fish {
    constructor(type = null) {
        this.type = type;
        this.baseSize = 30 + Math.random() * 20;
        this.reset();
    }

    reset() {
        this.x = -50;
        this.y = Math.random() * (canvas.height - 50);
        this.baseSpeed = 2 + Math.random() * 3;
        this.speed = this.baseSpeed;
        this.size = this.isPoisonous ? this.baseSize * 1.2 : this.baseSize;  // Adjust size based on type
        this.caught = false;
        this.bubbleY = 0;
        this.bubbleScale = 1;
        this.escaping = false;
        this.escapeTimer = 0;
        this.justCaught = false;

        // Determine fish type if not set
        if (!this.type) {
            const rand = Math.random();
            if (rand < POISON_FISH_CHANCE) {
                this.type = FISH_TYPES.POISON;
            } else if (rand < POISON_FISH_CHANCE + RARE_FISH_CHANCE) {
                this.type = FISH_TYPES.RARE;
            } else {
                this.type = FISH_TYPES.NORMAL;
            }
        }

        // Adjust properties based on type
        if (this.type === FISH_TYPES.POISON) {
            this.baseSpeed *= 1.3;
            this.size *= 1.2;
        } else if (this.type === FISH_TYPES.RARE) {
            this.baseSpeed *= 1.5; // Faster than normal fish
            this.size *= 0.9;     // Slightly smaller
        }
    }

    draw(context = ctx) {
        if (this.caught) {
            // Draw fish in bubble
            context.save();
            context.translate(this.x, this.y - this.bubbleY);
            context.scale(this.bubbleScale, this.bubbleScale);
            
            // Draw bubble
            context.beginPath();
            context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            context.fillStyle = 'rgba(255, 255, 255, 0.2)';
            context.arc(0, 0, this.size + 20, 0, Math.PI * 2);
            context.fill();
            context.stroke();
            
            // Draw fish inside bubble
            this.drawFishBody(0, 0, context);
            
            context.restore();
        } else {
            context.save();
            this.drawFishBody(this.x, this.y, context);
            context.restore();
        }
    }

    drawFishBody(x, y, context = ctx) {
        // Update colors based on type
        switch(this.type) {
            case FISH_TYPES.POISON:
                context.fillStyle = this.escaping ? '#9932CC' : '#800080';
                break;
            case FISH_TYPES.RARE:
                context.fillStyle = this.escaping ? '#FFD700' : '#FFA500';
                break;
            default:
                context.fillStyle = this.escaping ? '#ff4757' : '#ff6b6b';
        }
        
        // Fish body
        context.beginPath();
        context.ellipse(x, y, this.size, this.size/2, 0, 0, Math.PI * 2);
        context.fill();
        
        // Tail
        context.beginPath();
        context.moveTo(x - this.size, y);
        context.lineTo(x - this.size - 15, y - 10);
        context.lineTo(x - this.size - 15, y + 10);
        context.closePath();
        context.fill();

        // Top fin
        context.beginPath();
        context.moveTo(x - this.size/4, y - this.size/2);
        context.quadraticCurveTo(
            x, y - this.size,
            x + this.size/4, y - this.size/2
        );
        context.fill();

        // Bottom fin
        context.beginPath();
        context.moveTo(x - this.size/4, y + this.size/2);
        context.quadraticCurveTo(
            x, y + this.size,
            x + this.size/4, y + this.size/2
        );
        context.fill();

        // Eye
        context.fillStyle = 'white';
        context.beginPath();
        context.arc(x + this.size/2, y - this.size/6, this.size/8, 0, Math.PI * 2);
        context.fill();

        // Pupil
        context.fillStyle = 'black';
        context.beginPath();
        context.arc(x + this.size/2, y - this.size/6, this.size/16, 0, Math.PI * 2);
        context.fill();
    }

    update() {
        if (this.caught) {
            // Animate fish being caught in bubble
            this.bubbleY += 5;
            this.bubbleScale *= 0.95;
            
            if (this.justCaught) {
                restartSound(SOUNDS.bubble);
                this.justCaught = false;
            }
            
            if (this.bubbleScale < 0.1) {
                this.reset();
            }
        } else {
            this.x += this.speed;
            
            // Only normal fish and rare fish (with lower chance) try to escape
            if (this.type !== FISH_TYPES.POISON) {  // Poison fish never escape
                // Check if bubble is nearby
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 150 && !this.escaping) {
                    // Different escape chances based on type
                    const shouldEscape = this.type === FISH_TYPES.RARE ? 
                        Math.random() < RARE_ESCAPE_CHANCE :  // 10% for rare fish
                        Math.random() < NORMAL_ESCAPE_CHANCE; // 85% for normal fish
                    
                    if (shouldEscape) {
                        this.startEscape();
                    }
                }

                if (this.escaping) {
                    this.executeEscape();
                }
            }

            if (this.x > canvas.width + 50) {
                this.reset();
            }
        }
    }

    startEscape() {
        this.escaping = true;
        this.escapeTimer = 0;
        this.originalY = this.y;
        this.reverseTimer = 0;
        this.isReversing = false;
        
        this.escapeDirection = Math.random() > 0.5 ? 1 : -1;
        const escapeDistance = 250 + Math.random() * 150;
        this.targetY = this.y + (this.escapeDirection * escapeDistance);
        this.targetY = Math.max(50, Math.min(canvas.height - 50, this.targetY));
        this.speed = this.baseSpeed * (this.type === FISH_TYPES.RARE ? 5 : 4); // Rare fish escape faster
    }

    executeEscape() {
        this.escapeTimer += 1;
        
        // Chance to reverse direction during escape
        if (!this.isReversing && this.escapeTimer > 20 && Math.random() < 0.03) {
            this.isReversing = true;
            this.reverseTimer = 0;
            this.escapeDirection *= -1;
            const newEscapeDistance = 200 + Math.random() * 150;
            this.targetY = this.y + (this.escapeDirection * newEscapeDistance);
            this.targetY = Math.max(50, Math.min(canvas.height - 50, this.targetY));
            this.originalY = this.y;
        }
        
        // Calculate position with reverse movement
        let progress;
        if (this.isReversing) {
            this.reverseTimer += 1;
            progress = Math.min(this.reverseTimer / 30, 1);
        } else {
            progress = Math.min(this.escapeTimer / 45, 1);
        }
        
        const linearY = this.originalY + (this.targetY - this.originalY) * progress;
        this.y = linearY;
        
        // Keep fish within canvas bounds
        this.y = Math.max(50, Math.min(canvas.height - 50, this.y));
        
        // End escape after shorter duration or when reverse is complete
        if ((this.isReversing && this.reverseTimer >= 30) || 
            (!this.isReversing && this.escapeTimer >= 45)) {
            this.escaping = false;
            this.speed = this.baseSpeed;
        }
    }

    isClicked(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.size;
    }
}

// Water background effect
class WaterBackground {
    constructor() {
        this.waves = [
            { y: canvas.height * 0.3, offset: 0 },
            { y: canvas.height * 0.5, offset: Math.PI },
            { y: canvas.height * 0.7, offset: Math.PI / 2 }
        ];
    }

    update() {
        this.waves.forEach(wave => {
            wave.offset += 0.02;
        });
    }

    draw() {
        this.waves.forEach(wave => {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
            ctx.moveTo(0, wave.y);
            
            for (let x = 0; x < canvas.width; x += 10) {
                ctx.lineTo(
                    x,
                    wave.y + Math.sin(x * 0.02 + wave.offset) * 20
                );
            }
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        });
    }
}

// Create game objects
const waterBackground = new WaterBackground();
let fishes = [];  // Change from const to let

// Add resize handler
function resizeGame() {
    const container = document.querySelector('.game-container');
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;
    
    // Set canvas display size
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    
    // Set actual canvas size
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    // Reset scale factors
    canvas.scaleX = 1;
    canvas.scaleY = 1;
}

// Add orientation change handler
window.addEventListener('orientationchange', () => {
    setTimeout(resizeGame, 100); // Wait for orientation change to complete
});

// Add cursor position variables at the top
let cursorX = 0;
let cursorY = 0;
let targetX = 0;
let targetY = 0;

// Update mouse/touch position handlers
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    targetX = (event.clientX - rect.left) * canvas.scaleX;
    targetY = (event.clientY - rect.top) * canvas.scaleY;
});

canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    targetX = (touch.clientX - rect.left) * canvas.scaleX;
    targetY = (touch.clientY - rect.top) * canvas.scaleY;
}, { passive: false });

// Initialize resize handler
window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', resizeGame);

// Call resize on load
window.addEventListener('load', () => {
    resizeGame();
    gameLoopRunning = true;
    gameLoop();  // Start single game loop
});

// Initialize game state
function initGame() {
    score = 0;
    lives = 3;
    timeLeft = 60;
    gameActive = true;
    gameStarted = true;
    
    // Update UI
    document.getElementById('score').textContent = '0';
    document.getElementById('timer').textContent = '60';
    document.getElementById('lives').textContent = '3';
    
    // Clear existing fish array
    fishes = [];
    
    // Always spawn exactly:
    // - 2 purple (poison) fish
    // - 1 yellow (rare) fish
    // - 2 normal fish
    fishes.push(new Fish(FISH_TYPES.POISON));  // First poison fish
    fishes.push(new Fish(FISH_TYPES.POISON));  // Second poison fish
    fishes.push(new Fish(FISH_TYPES.RARE));    // One rare fish
    fishes.push(new Fish(FISH_TYPES.NORMAL));  // First normal fish
    fishes.push(new Fish(FISH_TYPES.NORMAL));  // Second normal fish

    // Randomize their positions
    fishes.forEach(fish => {
        fish.y = Math.random() * (canvas.height - 100) + 50; // Keep away from edges
    });
}

// Replace the setTimeout alert code in updateTimer with:
function showGameOver() {
    const gameOverCard = document.getElementById('gameOverCard');
    const bubbleContainer = gameOverCard.querySelector('.bubble-container');
    const finalScore = document.getElementById('finalScore');
    const finalHighScore = document.getElementById('finalHighScore');
    
    finalScore.textContent = score;
    finalHighScore.textContent = highScore;
    gameOverCard.classList.remove('hidden');
    
    // Clear existing bubbles
    bubbleContainer.innerHTML = '';
    
    // Add swimming fish at the bottom (increased number and variety)
    for (let i = 0; i < 8; i++) {  // Increased from 4 to 8 fish
        const fish = document.createElement('div');
        fish.className = 'bottom-fish';
        
        // Vary fish sizes
        const scale = 0.8 + Math.random() * 0.6;  // Scale between 0.8 and 1.4
        fish.style.transform = `scale(${scale})`;
        
        // Vary vertical positions more
        fish.style.bottom = (5 + Math.random() * 40) + 'px';  // Between 5px and 45px from bottom
        
        // Vary opacity
        fish.style.opacity = 0.7 + Math.random() * 0.3;
        
        // Vary animation duration
        const duration = 8 + Math.random() * 6;  // Between 8s and 14s
        fish.style.animationDuration = `${duration}s`;
        
        // Add random animation delay
        fish.style.animationDelay = `-${Math.random() * 8}s`;
        
        gameOverCard.appendChild(fish);
    }

    // Add regular bubbles
    for (let i = 0; i < 12; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 15 + 8;  // Smaller bubbles (8-23px)
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * 100 + '%';
        bubble.style.bottom = Math.random() * 100 + '%';
        bubble.style.animationDelay = Math.random() * 3 + 's';
        bubble.style.animationDuration = (Math.random() * 2 + 3) + 's';
        bubbleContainer.appendChild(bubble);
    }

    // Add large bubbles (but smaller than before)
    for (let i = 0; i < 5; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble-large';
        const size = Math.random() * 20 + 15;  // Smaller large bubbles (15-35px)
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * 100 + '%';
        bubble.style.bottom = Math.random() * 100 + '%';
        bubble.style.animationDelay = Math.random() * 2 + 's';
        bubble.style.animationDuration = (Math.random() * 2 + 4) + 's';
        bubbleContainer.appendChild(bubble);
    }

    // Add small bubbles
    for (let i = 0; i < 8; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble-small';
        const size = Math.random() * 8 + 4;  // Very small bubbles (4-12px)
        bubble.style.width = size + 'px';
        bubble.style.height = size + 'px';
        bubble.style.left = Math.random() * 100 + '%';
        bubble.style.bottom = Math.random() * 100 + '%';
        bubble.style.animationDelay = Math.random() * 2 + 's';
        bubble.style.animationDuration = (Math.random() * 1.5 + 2) + 's';
        bubbleContainer.appendChild(bubble);
    }
}

// Add function to animate score changes
function animateScoreChange(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('score-pulse');
    void element.offsetWidth; // Trigger reflow
    element.classList.add('score-pulse');
}

// Update timer function to add warning effect
function updateTimer() {
    if (!gameActive || !gameStarted) return;
    
    timeLeft--;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;
    
    // Add warning effect when time is low
    if (timeLeft <= 10) {
        timerElement.classList.add('timer-warning');
    } else {
        timerElement.classList.remove('timer-warning');
    }
    
    if (timeLeft <= 0) {
        gameActive = false;
        gameStarted = false;
        
        if (score > highScore) {
            highScore = score;
            document.getElementById('highScore').textContent = highScore;
        }
        
        // Fade out background music
        let fadeOut = setInterval(() => {
            if (SOUNDS.bgMusic.volume > 0.05) {
                SOUNDS.bgMusic.volume -= 0.05;
            } else {
                clearInterval(fadeOut);
                SOUNDS.bgMusic.pause();
                SOUNDS.bgMusic.volume = 0.4;
                SOUNDS.bgMusic.currentTime = 0;
                restartSound(SOUNDS.gameOver);
                showGameOver();
            }
        }, 100);
    }
    
    setTimeout(updateTimer, 1000);
}

// Simplify collision detection
function checkCollisions() {
    if (!gameActive) return;
    
    fishes.forEach(fish => {
        if (!fish.caught && fish.isClicked(mouseX, mouseY)) {
            const catchChance = fish.escaping ? 0.1 : 1;
            if (Math.random() < catchChance) {
                // Add ripple effect
                ripples.push(createRipple(fish.x, fish.y));
                
                // Add particles
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(
                        fish.x, 
                        fish.y, 
                        fish.type === FISH_TYPES.POISON ? '#800080' : 
                        fish.type === FISH_TYPES.RARE ? '#FFD700' : '#ff6b6b'
                    ));
                }

                fish.caught = true;
                fish.justCaught = true;
                fish.bubbleY = 0;
                fish.bubbleScale = 1;

                if (fish.type === FISH_TYPES.POISON && !shieldActive) {
                    lives--;
                    document.getElementById('lives').textContent = lives;
                    if (lives <= 0) {
                        gameActive = false;
                        gameStarted = false;
                        showGameOver();
                    }
                } else {
                    const now = Date.now();
                    if (now - lastCatchTime < 1000) { // Within 1 second
                        comboTimer = 60;
                        comboMultiplier = Math.min(comboMultiplier + 0.5, 4);
                    } else {
                        comboMultiplier = 1;
                    }
                    lastCatchTime = now;

                    const points = fish.type === FISH_TYPES.RARE ? 30 : 10;
                    score += Math.floor(points * comboMultiplier);
                    document.getElementById('score').textContent = score;
                    
                    // Update high score if current score is higher
                    if (score > highScore) {
                        highScore = score;
                        document.getElementById('highScore').textContent = highScore;
                    }
                }
                
                try {
                    // Choose appropriate sound based on fish type
                    let sound;
                    switch(fish.type) {
                        case FISH_TYPES.POISON:
                            sound = SOUNDS.poison;
                            break;
                        case FISH_TYPES.RARE:
                            sound = SOUNDS.rare;
                            break;
                        default:
                            sound = SOUNDS.bubble;
                    }
                    sound.currentTime = 0;
                    sound.play().catch(e => {
                        console.log('Sound failed:', e);
                    });
                } catch(e) {
                    console.log('Sound play failed');
                }
            }
        }
    });
}

// Initialize button handler
const startButton = document.getElementById('startButton');
canvas.style.display = 'block'; // Show canvas immediately for background

// Start background animation immediately
gameLoopRunning = true;

// Update start button handler
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';  // Hide start button
    document.querySelector('.logo-container').style.display = 'none';  // Hide logo
    gameStarted = true;
    gameActive = true;
    gameLoopRunning = true;
    
    // Initialize game
    initGame();
    updateTimer();
    gameLoop();
    
    // Start background music with fade in
    SOUNDS.bgMusic.volume = 0;
    SOUNDS.bgMusic.play().catch(error => {
        console.log('Background music failed to play:', error);
    });
    
    // Fade in background music
    let fadeIn = setInterval(() => {
        if (SOUNDS.bgMusic.volume < 0.4) {
            SOUNDS.bgMusic.volume += 0.05;
        } else {
            clearInterval(fadeIn);
        }
    }, 100);
});

// Initialize background music system
initBackgroundMusic();

// Update play again button handler
document.getElementById('playAgainButton').addEventListener('click', () => {
    // Stop current game loop and animations
    gameLoopRunning = false;
    
    // Wait for current loop to finish before starting new game
    setTimeout(() => {
        // Hide game over card
        document.getElementById('gameOverCard').classList.add('hidden');
        
        // Reset game states
        gameStarted = true;
        gameActive = true;
        
        // Clear and reset fish array
        fishes = [];
        
        // Initialize new game
        initGame();
        
        // Reset and start timer
        timeLeft = 60;
        updateTimer();
        
        // Reset and start background music
        SOUNDS.bgMusic.currentTime = 0;
        SOUNDS.bgMusic.volume = 0;
        SOUNDS.bgMusic.play().catch(error => {
            console.log('Background music failed to play:', error);
        });
        
        // Fade in background music
        let fadeIn = setInterval(() => {
            if (SOUNDS.bgMusic.volume < 0.4) {
                SOUNDS.bgMusic.volume += 0.05;
            } else {
                clearInterval(fadeIn);
            }
        }, 100);

        // Start new game loop
        gameLoopRunning = true;
        gameLoop();
    }, 100); // Short delay to ensure old loop is stopped
});

// Add pause control variables
let isPaused = false;
const pauseToggle = document.getElementById('pauseToggle');

// Add pause toggle function
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        pauseToggle.classList.add('paused');
        // Pause game logic
        gameLoopRunning = false;
        if (!isMusicMuted) {
            SOUNDS.bgMusic.pause();
        }
    } else {
        pauseToggle.classList.remove('paused');
        // Resume game logic
        gameLoopRunning = true;
        gameLoop();
        if (!isMusicMuted) {
            SOUNDS.bgMusic.play();
        }
    }
}

// Add click handler for pause toggle
pauseToggle.addEventListener('click', (e) => {
    e.preventDefault();
    if (gameStarted && gameActive) {
        togglePause();
    }
});

// Update game loop to check for pause
function gameLoop() {
    if (!gameLoopRunning || isPaused) return;

    try {
        // Clear canvas and draw background
        ctx.fillStyle = '#003366';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw water background
        waterBackground.update();
        waterBackground.draw();

        // Update and draw ripples
        ripples = ripples.filter(ripple => {
            ripple.update();
            ripple.draw();
            return ripple.opacity > 0;
        });

        // Update and draw particles
        particles = particles.filter(particle => {
            particle.update();
            particle.draw();
            return particle.alpha > 0 && particle.size > 0;
        });

        // Only draw game elements if game is started and active
        if (gameStarted && gameActive) {
            // Initialize cursor position if not set
            if (!cursorX && !cursorY) {
                cursorX = canvas.width / 2;
                cursorY = canvas.height / 2;
                targetX = cursorX;
                targetY = cursorY;
            }

            // Smooth cursor movement
            const easing = 0.2;
            cursorX += (targetX - cursorX) * easing;
            cursorY += (targetY - cursorY) * easing;
            
            // Update mouseX and mouseY for collision detection
            mouseX = cursorX;
            mouseY = cursorY;

            // Draw bubble cursor
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.arc(cursorX, cursorY, BUBBLE_SIZE, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw orbiting bubbles
            const time = Date.now() * 0.003;
            for (let i = 0; i < 3; i++) {
                const angle = time + i * (Math.PI * 2 / 3);
                const x = cursorX + Math.cos(angle) * 15;
                const y = cursorY + Math.sin(angle) * 15;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Update and draw fishes
            fishes.forEach(fish => {
                if (fish && typeof fish.update === 'function') {
                    fish.update();
                    fish.draw();
                }
            });

            // Check for collisions
            checkCollisions();

            // Update and draw power-ups
            updatePowerUps();
            powerUps = powerUps.filter(powerUp => {
                if (powerUp.active) {
                    powerUp.draw();
                    if (powerUp.isCollected(mouseX, mouseY)) {
                        powerUp.apply();
                        return false;
                    }
                    return true;
                }
                return false;
            });

            // Update shield
            if (shieldActive) {
                shieldDuration--;
                if (shieldDuration <= 0) {
                    shieldActive = false;
                }

                // Draw shield effect (blue expanding bubble)
                const progress = shieldDuration / SHIELD_MAX_DURATION;
                const size = BUBBLE_SIZE * (2 - progress * 0.5); // Slightly smaller expansion than time bonus
                const opacity = progress * 0.4; // Slightly more opaque than time bonus

                ctx.beginPath();
                ctx.strokeStyle = `rgba(65, 105, 225, ${opacity})`;
                ctx.fillStyle = `rgba(65, 105, 225, ${opacity * 0.3})`;
                ctx.lineWidth = 2;
                ctx.arc(cursorX, cursorY, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Add inner glow effect
                ctx.beginPath();
                ctx.strokeStyle = `rgba(135, 206, 250, ${opacity * 0.8})`; // Lighter blue
                ctx.lineWidth = 3;
                ctx.arc(cursorX, cursorY, BUBBLE_SIZE + 5, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Draw time bonus effect if active
            if (timeBonusActive) {
                timeBonusDuration--;
                if (timeBonusDuration <= 0) {
                    timeBonusActive = false;
                }

                // Draw expanding green bubble effect
                const progress = timeBonusDuration / TIME_BONUS_MAX_DURATION;
                const size = BUBBLE_SIZE * (2 - progress); // Expands from normal size to 2x
                const opacity = progress * 0.3; // Fades out as it expands

                ctx.beginPath();
                ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
                ctx.fillStyle = `rgba(0, 255, 0, ${opacity * 0.3})`;
                ctx.lineWidth = 2;
                ctx.arc(cursorX, cursorY, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }

        // Draw combo multiplier if active
        if (comboMultiplier > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '24px Arial';
            ctx.fillText(`${comboMultiplier.toFixed(1)}x`, 10, 30);
        }

        updateCombo();

        requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error('Game Loop Error:', error);
        gameLoopRunning = false;
    }
}

// Update score display with animation
function updateScore(newScore) {
    score = newScore;
    document.getElementById('score').textContent = score;
    animateScoreChange('score');
    
    if (score > highScore) {
        highScore = score;
        document.getElementById('highScore').textContent = highScore;
        animateScoreChange('highScore');
    }
}

// Update lives display with animation
function updateLives(newLives) {
    lives = newLives;
    document.getElementById('lives').textContent = lives;
    animateScoreChange('lives');
}

// Add music control variables
let isMusicMuted = false;
const musicToggle = document.getElementById('musicToggle');

// Add music toggle function
function toggleMusic() {
    isMusicMuted = !isMusicMuted;
    
    if (isMusicMuted) {
        musicToggle.classList.add('muted');
        SOUNDS.bgMusic.volume = 0;
    } else {
        musicToggle.classList.remove('muted');
        // Only restore volume if game is active
        if (gameActive && gameStarted) {
            SOUNDS.bgMusic.volume = 0.4;
        }
    }
}

// Add click handler for music toggle
musicToggle.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMusic();
});

// Update music handling in start game and play again
function startBackgroundMusic() {
    SOUNDS.bgMusic.currentTime = 0;
    SOUNDS.bgMusic.volume = isMusicMuted ? 0 : 0;
    SOUNDS.bgMusic.play().catch(error => {
        console.log('Background music failed to play:', error);
    });
    
    if (!isMusicMuted) {
        // Fade in background music
        let fadeIn = setInterval(() => {
            if (SOUNDS.bgMusic.volume < 0.4) {
                SOUNDS.bgMusic.volume += 0.05;
            } else {
                clearInterval(fadeIn);
            }
        }, 100);
    }
}

// Update existing start button handler
startButton.addEventListener('click', () => {
    startButton.style.display = 'none';  // Hide start button
    document.querySelector('.logo-container').style.display = 'none';  // Hide logo
    gameStarted = true;
    gameActive = true;
    gameLoopRunning = true;
    
    // Initialize game
    initGame();
    updateTimer();
    gameLoop();
    
    // Start background music with fade in
    SOUNDS.bgMusic.volume = 0;
    SOUNDS.bgMusic.play().catch(error => {
        console.log('Background music failed to play:', error);
    });
    
    // Fade in background music
    let fadeIn = setInterval(() => {
        if (SOUNDS.bgMusic.volume < 0.4) {
            SOUNDS.bgMusic.volume += 0.05;
        } else {
            clearInterval(fadeIn);
        }
    }, 100);
});

// Update play again handler
document.getElementById('playAgainButton').addEventListener('click', () => {
    // ... existing code ...
    startBackgroundMusic();
    // ... rest of code ...
});

// Update Particle class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;  // Initial size
        this.velocity = {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3
        };
        this.alpha = 1;
        this.initialSize = this.size;  // Store initial size
    }
    
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
        // Ensure size doesn't go below 0
        this.size = Math.max(0, this.initialSize * this.alpha);
    }
    
    draw() {
        if (this.size <= 0) return;  // Don't draw if size is 0 or negative
        
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Add ripple effect function
function createRipple(x, y) {
    const ripple = {
        x, y,
        radius: 0,
        maxRadius: 50,
        opacity: 0.5,
        update() {
            this.radius += 2;
            this.opacity -= 0.02;
        },
        draw() {
            if (this.opacity > 0) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
                ctx.lineWidth = 2;
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    };
    return ripple;
}

// Add combo update function
function updateCombo() {
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            comboMultiplier = 1;
        }
    }
}

// Add achievement system
const achievements = {
    firstCatch: { name: "First Catch", description: "Catch your first fish", unlocked: false },
    comboMaster: { name: "Combo Master", description: "Reach 4x combo", unlocked: false },
    rareHunter: { name: "Rare Hunter", description: "Catch 3 rare fish", unlocked: false },
    survivor: { name: "Survivor", description: "Survive with 1 life", unlocked: false },
    highScorer: { name: "High Scorer", description: "Score over 300 points", unlocked: false }
};

// Add power-up system
class PowerUp {
    constructor() {
        this.x = Math.random() * (canvas.width - 40) + 20;
        this.y = Math.random() * (canvas.height - 40) + 20;
        this.type = Math.random() < 0.5 ? 'timeBonus' : 'shield';
        this.size = 30;  // Increased from 20 to 30
        this.active = true;
        this.duration = 300;
        this.collected = false;
    }

    draw() {
        if (!this.active) return;

        ctx.save();
        
        // Draw outer bubble (bigger)
        ctx.beginPath();
        const color = this.type === 'timeBonus' ? 
            'rgba(0, 255, 0, 0.2)' :  // More transparent
            'rgba(65, 105, 225, 0.2)';
        const strokeColor = this.type === 'timeBonus' ?
            'rgba(0, 255, 0, 0.6)' :
            'rgba(65, 105, 225, 0.6)';
            
        // Draw main bubble effect
        ctx.fillStyle = color;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Add inner glow (bigger radius)
        ctx.beginPath();
        const glowColor = this.type === 'timeBonus' ?
            'rgba(144, 238, 144, 0.3)' :
            'rgba(135, 206, 250, 0.3)';
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 4;
        ctx.arc(this.x, this.y, this.size - 8, 0, Math.PI * 2);
        ctx.stroke();

        // Draw icon (slightly bigger)
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';  // Increased from 16px to 20px
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type === 'timeBonus' ? '⏰' : '🛡️', this.x, this.y);

        // Add small orbiting bubbles (bigger orbit)
        const time = Date.now() * 0.003;
        for (let i = 0; i < 3; i++) {
            const angle = time + i * (Math.PI * 2 / 3);
            const orbitRadius = this.size + 8;  // Increased orbit radius
            const x = this.x + Math.cos(angle) * orbitRadius;
            const y = this.y + Math.sin(angle) * orbitRadius;
            
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.arc(x, y, 4, 0, Math.PI * 2);  // Slightly bigger orbiting bubbles
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    // Update collision detection for bigger size
    isCollected(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.size + BUBBLE_SIZE;
    }

    apply() {
        if (this.type === 'timeBonus') {
            timeLeft += 10; // Add 10 seconds
            document.getElementById('timer').textContent = timeLeft;
            showPopupMessage('+10 seconds!', '#00ff00');
            // Add visual effect
            timeBonusActive = true;
            timeBonusDuration = TIME_BONUS_MAX_DURATION;
        } else {
            activateShield();
            showPopupMessage('Shield Active!', '#4169e1');
        }
    }
}

// Add power-up management
let powerUps = [];
let shieldActive = false;
let shieldDuration = 0;
const SHIELD_MAX_DURATION = 300; // 5 seconds at 60fps
let lastPowerUpTime = 0;

function activateShield() {
    shieldActive = true;
    shieldDuration = SHIELD_MAX_DURATION;
}

function updatePowerUps() {
    const now = Date.now();
    if (now - lastPowerUpTime > 10000 && powerUps.length < 2) { // Spawn every 10 seconds, max 2
        powerUps.push(new PowerUp());
        lastPowerUpTime = now;
    }
}

function showPopupMessage(text, color) {
    const popup = document.createElement('div');
    popup.className = 'popup-message';
    popup.textContent = text;
    popup.style.color = color;
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.remove();
    }, 2000);
}

// Add achievement notification
function unlockAchievement(id) {
    if (!achievements[id].unlocked) {
        achievements[id].unlocked = true;
        showAchievementPopup(achievements[id].name);
        saveAchievements();
    }
}

function showAchievementPopup(name) {
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `
        <span class="achievement-icon">🏆</span>
        <div class="achievement-text">
            <div class="achievement-title">Achievement Unlocked!</div>
            <div class="achievement-name">${name}</div>
        </div>
    `;
    document.body.appendChild(popup);
    
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 1000);
    }, 3000);
}

// Add main menu button handlers
const mainMenuButton = document.getElementById('mainMenuButton');
const menuConfirmModal = document.getElementById('menuConfirmModal');
const confirmMenuButton = document.getElementById('confirmMenu');
const cancelMenuButton = document.getElementById('cancelMenu');

// Show confirmation modal when menu button is clicked
mainMenuButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (gameStarted && gameActive) {
        // Pause game while showing modal
        if (!isPaused) {
            togglePause();
        }
        menuConfirmModal.style.display = 'flex';
    }
});

// Handle confirmation to return to main menu
confirmMenuButton.addEventListener('click', () => {
    // Reset game state
    gameStarted = false;
    gameActive = false;
    gameLoopRunning = false;
    isPaused = false;
    score = 0;
    lives = 3;
    timeLeft = 60;
    
    // Reset UI
    document.getElementById('score').textContent = '0';
    document.getElementById('timer').textContent = '60';
    document.getElementById('lives').textContent = '3';
    
    // Clear arrays
    fishes = [];
    particles = [];
    ripples = [];
    powerUps = [];
    
    // Stop music
    SOUNDS.bgMusic.pause();
    SOUNDS.bgMusic.currentTime = 0;
    
    // Hide modal
    menuConfirmModal.style.display = 'none';
    
    // Show start button
    startButton.style.display = 'block';
    
    // Hide game over card if visible
    document.getElementById('gameOverCard').classList.add('hidden');
    
    // Reset pause button
    pauseToggle.classList.remove('paused');
    
    // Start background animation
    gameLoopRunning = true;
    gameLoop();
    
    document.querySelector('.logo-container').style.display = 'block';  // Show logo again
});

// Handle cancellation
cancelMenuButton.addEventListener('click', () => {
    menuConfirmModal.style.display = 'none';
    // Resume game if it was running
    if (isPaused) {
        togglePause();
    }
});

// Close modal if clicking outside
menuConfirmModal.addEventListener('click', (e) => {
    if (e.target === menuConfirmModal) {
        menuConfirmModal.style.display = 'none';
        if (isPaused) {
            togglePause();
        }
    }
});

// Add help button handlers
const helpButton = document.getElementById('helpButton');
const rulesCard = document.getElementById('rulesCard');
const closeRulesBtn = rulesCard.querySelector('.close-btn');

// Update close button handler
closeRulesBtn.addEventListener('click', (e) => {
    e.preventDefault();
    rulesCard.style.display = 'none';
    if (gameStarted && gameActive && isPaused) {
        togglePause();
    }
});

// Keep click outside to close
rulesCard.addEventListener('click', (e) => {
    if (e.target === rulesCard) {
        rulesCard.style.display = 'none';
        if (gameStarted && gameActive && isPaused) {
            togglePause();
        }
    }
});

// Help button handler
helpButton.addEventListener('click', (e) => {
    e.preventDefault();
    rulesCard.style.display = 'flex';
    if (gameStarted && gameActive && !isPaused) {
        togglePause();
    }
});  