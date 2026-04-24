const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(__dirname));

const gravity = 0.7;
const canvasWidth = 1024;
const canvasHeight = 576;

class Player {
    constructor({ position, color, direction, attackBox, attackFrames }) {
        this.position = position;
        this.velocity = { x: 0, y: 0 };
        this.width = 50;
        this.height = 150;
        this.lastKey = '';
        this.attackBox = {
            position: { x: this.position.x, y: this.position.y },
            offset: attackBox.offset,
            width: attackBox.width,
            height: attackBox.height
        };
        this.attackFrames = attackFrames || { punch: { delay: 100, duration: 200 }, kick: { delay: 100, duration: 200 } };
        this.color = color;
        this.isAttacking = false;
        this.isHitting = false;
        this.attackType = null;
        this.health = 100;
        this.dead = false;
        this.takeHit = false;
        this.direction = direction;
        this.keys = { left: false, right: false, up: false };
    }

    update() {
        if (this.dead) return;

        // attackBox update
        if (this.direction === 'right') {
            this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        } else {
            this.attackBox.position.x = this.position.x + this.width - this.attackBox.offset.x - this.attackBox.width;
        }
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        if (this.position.y + this.height + this.velocity.y >= canvasHeight - 50) {
            this.velocity.y = 0;
            this.position.y = canvasHeight - this.height - 50;
        } else {
            this.velocity.y += gravity;
        }

        if (this.position.x <= 0) this.position.x = 0;
        if (this.position.x + this.width >= canvasWidth) this.position.x = canvasWidth - this.width;
    }

    attack(type) {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackType = type;
        io.emit('playSound', { type: type });
        
        const delay = this.attackFrames[type]?.delay || 100;
        const duration = this.attackFrames[type]?.duration || 200;

        setTimeout(() => {
            if (this.dead || this.takeHit) return;
            this.isHitting = true;
            // The active hit frame is very short to avoid multiple registrations
            setTimeout(() => {
                this.isHitting = false;
            }, 50); 
        }, delay);

        setTimeout(() => {
            this.isAttacking = false;
        }, duration);
    }
}

let p1Id = null;
let p2Id = null;

let gameState;

function initGame() {
    gameState = {
        player1: new Player({ 
            position: { x: 200, y: 0 }, 
            color: '#3b82f6', 
            direction: 'right',
            attackBox: { offset: { x: 50, y: 50 }, width: 180, height: 50 },
            attackFrames: { 
                punch: { delay: 333, duration: 500 }, 
                kick: { delay: 333, duration: 500 } 
            }
        }),
        player2: new Player({ 
            position: { x: 750, y: 100 }, 
            color: '#ef4444', 
            direction: 'left',
            attackBox: { offset: { x: 50, y: 50 }, width: 180, height: 50 },
            attackFrames: { 
                punch: { delay: 166, duration: 333 }, 
                kick: { delay: 166, duration: 333 } 
            }
        }),
        timer: 60,
        winner: null
    };
    if (timerId) clearTimeout(timerId);
    decreaseTimer();
}

let timerId;
function decreaseTimer() {
    if (gameState.timer > 0 && !gameState.winner) {
        gameState.timer--;
        timerId = setTimeout(decreaseTimer, 1000);
    }
    if (gameState.timer === 0 && !gameState.winner) {
        determineWinner();
    }
}

initGame();

function determineWinner() {
    if (gameState.player1.health === gameState.player2.health) {
        gameState.winner = 'Tie';
    } else if (gameState.player1.health > gameState.player2.health) {
        gameState.winner = 'Player 1 Wins';
    } else {
        gameState.winner = 'Player 2 Wins';
    }
}

function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    );
}

io.on('connection', (socket) => {
    let role = 'spectator';
    if (!p1Id) {
        p1Id = socket.id;
        role = 'player1';
    } else if (!p2Id) {
        p2Id = socket.id;
        role = 'player2';
    }
    
    socket.emit('role', role);

    socket.on('keydown', (key) => {
        let p = role === 'player1' ? gameState.player1 : (role === 'player2' ? gameState.player2 : null);
        if (!p || p.dead || gameState.winner) return;

        switch(key) {
            case 'left':
                p.keys.left = true;
                p.lastKey = 'left';
                break;
            case 'right':
                p.keys.right = true;
                p.lastKey = 'right';
                break;
            case 'up':
                if (p.position.y >= canvasHeight - p.height - 50) {
                    p.velocity.y = -18;
                    io.emit('playSound', { type: 'jump' });
                }
                break;
            case 'punch':
                p.attack('punch');
                break;
            case 'kick':
                p.attack('kick');
                break;
        }
    });

    socket.on('keyup', (key) => {
        let p = role === 'player1' ? gameState.player1 : (role === 'player2' ? gameState.player2 : null);
        if (!p) return;
        if (key === 'left') p.keys.left = false;
        if (key === 'right') p.keys.right = false;
    });

    socket.on('disconnect', () => {
        if (socket.id === p1Id) p1Id = null;
        if (socket.id === p2Id) p2Id = null;
    });

    socket.on('restart', () => {
        initGame();
        io.emit('update', gameState);
    });
});

setInterval(() => {
    let p1 = gameState.player1;
    let p2 = gameState.player2;

    if (!gameState.winner) {
        // Face each other
        if (p1.position.x + p1.width / 2 < p2.position.x + p2.width / 2) {
            p1.direction = 'right';
            p2.direction = 'left';
        } else {
            p1.direction = 'left';
            p2.direction = 'right';
        }

        p1.velocity.x = 0;
        if (p1.keys.left && p1.lastKey === 'left') p1.velocity.x = -6;
        else if (p1.keys.right && p1.lastKey === 'right') p1.velocity.x = 6;

        p2.velocity.x = 0;
        if (p2.keys.left && p2.lastKey === 'left') p2.velocity.x = -6;
        else if (p2.keys.right && p2.lastKey === 'right') p2.velocity.x = 6;

        p1.update();
        p2.update();

        // Collisions
        if (p1.isHitting && rectangularCollision({ rectangle1: p1, rectangle2: p2 })) {
            p1.isHitting = false;
            p2.health -= p1.attackType === 'kick' ? 15 : 5;
            p2.takeHit = true;
            p2.isAttacking = false;
            setTimeout(() => { p2.takeHit = false; }, 150);
            io.emit('playSound', { type: 'hit' });
            if (p2.health <= 0) { p2.health = 0; p2.dead = true; determineWinner(); }
        }

        if (p2.isHitting && rectangularCollision({ rectangle1: p2, rectangle2: p1 })) {
            p2.isHitting = false;
            p1.health -= p2.attackType === 'kick' ? 15 : 5;
            p1.takeHit = true;
            p1.isAttacking = false;
            setTimeout(() => { p1.takeHit = false; }, 150);
            io.emit('playSound', { type: 'hit' });
            if (p1.health <= 0) { p1.health = 0; p1.dead = true; determineWinner(); }
        }
    }

    io.emit('update', gameState);
}, 1000 / 60);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});