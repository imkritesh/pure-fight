# Fighter Game

A multiplayer 2D fighting game built with Node.js, Express, Socket.IO, and HTML5 Canvas.

## Requirements

- [Node.js](https://nodejs.org/) (v14 or newer recommended)

## Installation

1. Clone or download the repository.
2. Open a terminal in the project directory.
3. Install the dependencies:
   ```bash
   npm install
   ```

## Running the Game

1. Start the game server:
   ```bash
   node server.js
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```
3. To play multiplayer, open the same URL in another browser window or tab. The first two connections will be assigned as Player 1 and Player 2. Subsequent connections will be spectators.

## Architecture & Communication
For detailed information on how the client and server communicate using WebSockets, and for an overview of the game's architecture, please see [ARCHITECTURE.md](ARCHITECTURE.md).

## Controls

The game supports keyboard controls. (Make sure your browser window is focused!)

- **Arrow Keys**: Move (Left, Right) and Jump (Up)
- **K**: Punch
- **L**: Kick
