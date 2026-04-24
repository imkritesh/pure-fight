# Architecture and WebSocket Communication

This document explains the high-level architecture of the game and details the WebSocket communication between the client and the server.

## Overview
The game runs on a client-server architecture using **Node.js** with **Express** and **Socket.io** on the backend, and standard **HTML5 Canvas** with **JavaScript** on the frontend.
- **Server (`server.js`)**: The server holds the single source of truth for the game state. It handles the physics, collisions, attack hit registrations, and game timers. The server runs a game loop at roughly 60 FPS (using `setInterval`) and broadcasts the updated state to all connected clients.
- **Client (`index.js`)**: The client acts as a "dumb terminal" that only sends user inputs to the server and renders the visual representation (animations, UI, sprites, health bars) based on the state received from the server. It also handles audio playback based on specific events sent by the server.

## WebSocket Communication

WebSockets (via `Socket.io`) are used for real-time, bidirectional communication between the clients and the server.

### Events Sent from Server to Client

1. **`role`**
   - **Payload**: `String` (e.g., `'player1'`, `'player2'`, `'spectator'`)
   - **Description**: Sent to a client immediately upon connection. It assigns the connecting user to an available player slot. Once both slots are filled, subsequent connections are assigned the role of `'spectator'`.

2. **`update`**
   - **Payload**: `Object` (The `gameState` object, containing player positions, health, bounding boxes, current actions, and the game timer).
   - **Description**: Broadcasted to all connected clients approximately 60 times a second. The clients use this state to update the UI and render the correct sprites on the HTML Canvas.

3. **`playSound`**
   - **Payload**: `Object` (e.g., `{ type: 'punch' }`)
   - **Description**: Emitted when a specific game event occurs (like jumping, attacking, or getting hit). The client receives this and plays the corresponding synthesized sound using the Web Audio API.

### Events Sent from Client to Server

1. **`keydown`**
   - **Payload**: `String` representing an action (e.g., `'left'`, `'right'`, `'up'`, `'punch'`, `'kick'`)
   - **Description**: Triggered when a player presses a mapped key. The server processes this action and updates the player's velocity or attack state. Spectators cannot emit this event successfully.

2. **`keyup`**
   - **Payload**: `String` representing an action (e.g., `'left'`, `'right'`)
   - **Description**: Triggered when a player releases a mapped key. Used primarily for stopping horizontal movement.

3. **`restart`**
   - **Payload**: `None`
   - **Description**: Triggered when the "Restart Game" button is clicked at the end of a match. The server receives this and re-initializes the game state.

## State Management
Since the server governs the main game loop, latency is handled implicitly. Players send their inputs, and those inputs are factored into the next frame calculated by the server. This prevents cheating and keeps clients perfectly synchronized.
