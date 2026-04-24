const socket = io();

const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024;
canvas.height = 576;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const KEY_MAP = {
    'ArrowRight': 'right',
    'ArrowLeft': 'left',
    'ArrowUp': 'up',
    'k': 'punch',
    'l': 'kick'
};

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const time = audioCtx.currentTime;
    
    const soundConfigs = {
        'punch': { type: 'sine', fStart: 150, fEnd: 40, dur: 0.1, vStart: 1, vEnd: 0.01, ramp: 'exp' },
        'kick':  { type: 'triangle', fStart: 100, fEnd: 20, dur: 0.15, vStart: 1, vEnd: 0.01, ramp: 'exp' },
        'hit':   { type: 'square', fStart: 300, fEnd: 50, dur: 0.1, vStart: 0.3, vEnd: 0.01, ramp: 'exp' },
        'jump':  { type: 'sine', fStart: 300, fEnd: 500, dur: 0.2, vStart: 0.2, vEnd: 0.01, ramp: 'linear' }
    };

    const cfg = soundConfigs[type];
    if (cfg) {
        oscillator.type = cfg.type;
        oscillator.frequency.setValueAtTime(cfg.fStart, time);
        if (cfg.ramp === 'exp') {
            oscillator.frequency.exponentialRampToValueAtTime(cfg.fEnd, time + cfg.dur);
        } else {
            oscillator.frequency.linearRampToValueAtTime(cfg.fEnd, time + cfg.dur);
        }
        
        gainNode.gain.setValueAtTime(cfg.vStart, time);
        gainNode.gain.exponentialRampToValueAtTime(cfg.vEnd, time + cfg.dur);
        
        oscillator.start();
        oscillator.stop(time + cfg.dur);
    }
}

let role = 'spectator';
let gameState = null;

socket.on('role', (r) => {
    role = r;
    console.log('You are:', role);
});

socket.on('playSound', (data) => {
    playSound(data.type);
});

socket.on('update', (state) => {
    gameState = state;
    document.querySelector('#timer').innerHTML = state.timer;
    document.querySelector('#playerHealth').style.width = Math.max(0, state.player1.health) + '%';
    document.querySelector('#enemyHealth').style.width = Math.max(0, state.player2.health) + '%';
    
    if (state.winner) {
        document.querySelector('#displayText').style.display = 'flex';
        document.querySelector('#winnerText').innerHTML = state.winner;
        document.querySelector('#restartBtn').style.display = 'block';
    } else {
        document.querySelector('#displayText').style.display = 'none';
        document.querySelector('#restartBtn').style.display = 'none';
    }
});

document.querySelector('#restartBtn').addEventListener('click', () => {
    socket.emit('restart');
});

function initSprite(framesMax) {
    return { img: new Image(), framesMax };
}

const sprites = {
    player1: {
        idle: initSprite(8), run: initSprite(8), jump: initSprite(2), fall: initSprite(2),
        attack1: initSprite(6), attack2: initSprite(6), death: initSprite(6), takeHit: initSprite(4)
    },
    player2: {
        idle: initSprite(4), run: initSprite(8), jump: initSprite(2), fall: initSprite(2),
        attack1: initSprite(4), attack2: initSprite(4), death: initSprite(7), takeHit: initSprite(3)
    }
};

const loadSprites = (player, folder) => {
    for (const action in sprites[player]) {
        const filename = action.charAt(0).toUpperCase() + action.slice(1);
        sprites[player][action].img.src = `img/${folder}/${filename}.png`;
    }
};

loadSprites('player1', 'samuraiMack');
loadSprites('player2', 'kenji');

const animState = {
    player1: { frameCurrent: 0, framesElapsed: 0, framesHold: 5, currentSprite: sprites.player1.idle, action: 'idle' },
    player2: { frameCurrent: 0, framesElapsed: 0, framesHold: 5, currentSprite: sprites.player2.idle, action: 'idle' }
};

const offsets = {
    player1: { x: 215, y: 157 },
    player2: { x: 215, y: 167 }
};

function updateAnim(pId, player) {
    const s = animState[pId];
    const pSprites = sprites[pId];
    
    // Increment frames FIRST so we know if the animation finished
    s.framesElapsed++;
    if (s.framesElapsed % s.framesHold === 0) {
        if (s.frameCurrent < s.currentSprite.framesMax - 1) {
            s.frameCurrent++;
        } else {
            if (s.action !== 'death') {
                s.frameCurrent = 0;
            }
        }
    }

    let nextAction = 'idle';
    if (player.dead) nextAction = 'death';
    else if (player.takeHit) nextAction = 'takeHit';
    else if (player.isAttacking) nextAction = player.attackType === 'kick' ? 'attack2' : 'attack1';
    else if (player.velocity.y < 0) nextAction = 'jump';
    else if (player.velocity.y > 0) nextAction = 'fall';
    else if (player.velocity.x !== 0) nextAction = 'run';
    
    if (s.action !== nextAction) {
        // Don't interrupt death
        if (s.action === 'death' && s.frameCurrent === pSprites.death.framesMax - 1 && player.dead) return;
        
        // Don't interrupt takeHit until it finishes, UNLESS they died
        if (s.action === 'takeHit' && nextAction !== 'death') {
            const totalFrames = pSprites.takeHit.framesMax * s.framesHold;
            if (s.framesElapsed < totalFrames) {
                return; // still animating
            }
        }

        // Don't interrupt attack until it finishes, UNLESS they died or get hit
        if ((s.action === 'attack1' || s.action === 'attack2') && nextAction !== 'death' && nextAction !== 'takeHit') {
            // The attack has finished if frameCurrent reset to 0 AND we've elapsed enough frames to complete it.
            // framesMax * framesHold is the total duration of the animation
            const totalFrames = pSprites[s.action].framesMax * s.framesHold;
            if (s.framesElapsed < totalFrames) {
                return; // still animating
            }
        }

        s.action = nextAction;
        s.currentSprite = pSprites[nextAction];
        s.frameCurrent = 0;
        s.framesElapsed = 0; // Reset framesElapsed when switching actions!
    }
}

function drawPlayer(player, pId) {
    updateAnim(pId, player);
    
    const s = animState[pId];
    if (!s.currentSprite.img.complete) return;
    
    const scale = 2.5;
    const offset = offsets[pId];
    
    c.save();
    
    let drawX = player.position.x - offset.x;
    let drawY = player.position.y - offset.y;
    
    // player1 natively faces right, player2 (Kenji) natively faces left
    const nativelyFacesLeft = (pId === 'player2');
    const shouldFlip = nativelyFacesLeft ? (player.direction === 'right') : (player.direction === 'left');
    
    if (shouldFlip) {
        c.translate(player.position.x + player.width / 2, 0);
        c.scale(-1, 1);
        drawX = -player.width / 2 - offset.x;
    }
    
    c.drawImage(
        s.currentSprite.img,
        s.frameCurrent * (s.currentSprite.img.width / s.currentSprite.framesMax),
        0,
        s.currentSprite.img.width / s.currentSprite.framesMax,
        s.currentSprite.img.height,
        drawX,
        drawY,
        (s.currentSprite.img.width / s.currentSprite.framesMax) * scale,
        s.currentSprite.img.height * scale
    );
    
    c.restore();
}

const bgImage = new Image();
bgImage.src = 'img/background.png';

function animate() {
    window.requestAnimationFrame(animate);
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background image
    if (bgImage.complete) {
        c.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw ground
    c.fillStyle = '#333';
    c.fillRect(0, canvas.height - 50, canvas.width, 50);

    if (gameState) {
        // Draw background or static environment if needed
        // Background was requested as black ground earlier

        // Render player 1
        drawPlayer(gameState.player1, 'player1');
        // Render player 2
        drawPlayer(gameState.player2, 'player2');
        
        // Render current player role
        c.fillStyle = 'white';
        c.font = '20px Courier New';
        c.fillText(`Role: ${role}`, 20, 30);
    }
}

animate();

window.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
});
window.addEventListener('keydown', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
});

window.addEventListener('keydown', (event) => {
    if (role === 'spectator') return;

    const action = KEY_MAP[event.key];
    if (action) {
        socket.emit('keydown', action);
    }
});

window.addEventListener('keyup', (event) => {
    if (role === 'spectator') return;

    const action = KEY_MAP[event.key];
    if (action === 'left' || action === 'right') { // Only movement keys have keyup events
        socket.emit('keyup', action);
    }
});