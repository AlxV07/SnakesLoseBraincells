import {url, key} from "./credentials.js";

const mapWidth = 3000
const mapHeight = 3000

function distance(a, b) {return Math.hypot(b.x - a.x, b.y - a.y)}


const originalConsoleLog = console.log;
console.log = function (...args) {
    originalConsoleLog.apply(console, args);
    const message = args.map(arg => JSON.stringify(arg)).join(' ');
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        const newLog = document.createElement('div');
        newLog.textContent = message;
        logOutput.appendChild(newLog);
        logOutput.scrollTop = logOutput.scrollHeight;
    }
};


class Snake {
    constructor(player) {
        this.player = player

        this.radius = 15
        this.parts  = []
        for (let i = 0; i < 5; i++) { this.parts.push({x: 0, y: 0}); }
        this.head = this.parts[0]

        this.speed = 10
        this.direction = 0
        this.mouseDown = false
    }

    dataFormat() {
        return {
            radius: this.radius,
            parts: this.parts,
            player: this.player,
            direction: this.direction
        }
    }

    updateSpeed(shouldShrink) {
        if (this.mouseDown && this.parts.length > 5) {
            this.speed = 13
            if (shouldShrink) {
                this.shrink()
            }
        } else {
            this.speed = 5
        }
    }

    updatePosition() {
        this.head.x += Math.cos(this.direction) * this.speed;
        this.head.y += Math.sin(this.direction) * this.speed;

        // TODO: fix wrong turning

        for (let i = 1; i < this.parts.length; i++) {
            const prevSegment = this.parts[i - 1];
            const segment = this.parts[i];

            const dx = prevSegment.x - segment.x;
            const dy = prevSegment.y - segment.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > this.radius) {
                const angle = Math.atan2(dy, dx);
                segment.x += Math.cos(angle) * (distance - this.radius);
                segment.y += Math.sin(angle) * (distance - this.radius);
            }
        }
    }

    grow() {
        let a = this.parts[this.parts.length - 1].x;
        let b = this.parts[this.parts.length - 1].y;
        this.parts.push({x: a, y: b})
        this.radius += 0.2
    }

    shrink() {
        this.parts.pop()
        this.radius -= 0.2
    }

    die() {

    }
}


class GameMaster {
    constructor() {
        this.tickCount = 0
        this.ticksPerSecond = 35
        this.gameInterval = null;

        this.sb = null;
        this.connectChannel = null;  // Players Join or Leave
        this.dataChannel = null;     // Snake & Food & Player Deaths Data
        this.stateChannel = null;    // Players Spawn & UpdateState

        this.deaths = []
        this.snakes = {}
        this.food = []
    }

    setupSupabase() {
        this.sb = supabase.createClient(url, key);

        // Define channels
        this.connectChannel = this.sb.channel('connect')
        this.dataChannel = this.sb.channel('data')
        this.stateChannel = this.sb.channel('spawn')

        // Subscribe to channels
        this.connectChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Game Master subscribed to connectChannel.') } })
        this.dataChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Game Master subscribed to dataChannel.') } })
        this.stateChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Game Master subscribed to spawnChannel.') } })

        // Add listeners to select channels
        this.connectChannel.on('broadcast', {event: 'player-joined'}, (b) => {this.onPlayerJoined(b.payload)})
        this.connectChannel.on('broadcast', {event: 'player-left'}, (b) => {this.onPlayerLeft(b.payload)})
        this.stateChannel.on('broadcast', {event: 'player-spawned'}, (b) => {this.onPlayerSpawned(b.payload)})
        this.stateChannel.on('broadcast', {event: 'player-state-updated'}, (b) => {this.onPlayerStateUpdated(b.payload)})
    }

    onPlayerJoined(payload) {
        const player = payload.player
        this.snakes[player] = null
        console.log(`${player} joined.`)
    }

    onPlayerLeft(payload) {
        const player = payload.player
        delete(this.snakes[player])
        console.log(`${player} left.`)
    }

    onPlayerSpawned(payload) {
        const player = payload.player
        const newSnake = new Snake()
        newSnake.head.x = Math.min(Math.max(mapWidth / 4, Math.random() * mapWidth), 3 * mapWidth / 4)
        newSnake.head.y = Math.min(Math.max(mapHeight / 4, Math.random() * mapHeight), 3 * mapHeight / 4)
        this.snakes[player] = newSnake
        console.log(`${player} spawned.`)
    }

    onPlayerStateUpdated(payload) {
        const player = payload.player
        const direction = payload.direction
        const mouseDown = payload.mouseDown

        this.snakes[player].direction = direction
        this.snakes[player].mouseDown = mouseDown
    }

    startGame() {
        this.gameInterval = setInterval(() => {
            this.updateGame()
        }, 1000 / this.ticksPerSecond)
    }

    updateGame() {  // Updates 50 times per second
        // Clear Deaths
        this.deaths = []

        // Snakes
        for (let player in this.snakes) {
            if (this.snakes[player] !== null) {
                this.updateSnake(player)
            }
        }

        // Food
        if (this.tickCount % this.ticksPerSecond === 0) {
            this.genNewFood()
        }

        // Kill dead snakes
        this.killDeadSnakes()

        // Broadcast
        this.broadcastData()

        // Log Tick Count
        if (this.tickCount % this.ticksPerSecond === 0) {
            console.log('Tick Count:', this.tickCount)
        }

        this.tickCount += 1
    }

    broadcastData() {
        // Get snakes in data format
        const dataFormatSnakes = {}
        for (let player in this.snakes) {
            if (this.snakes[player] !== null) {
                dataFormatSnakes[player] = this.snakes[player].dataFormat()  // Client just needs player, radius, and parts to draw snake
            }
        }

        // Send
        this.dataChannel.send({
            type: 'broadcast',
            event: 'update-game',
            payload: {
                deaths: this.deaths,
                snakes: dataFormatSnakes,
                food: this.food
            }
        })
    }

    killDeadSnakes() {
        for (let i = 0; i < this.deaths.length; i++) {
            const player = this.deaths[i]
            this.snakes[player] = null  // TODO: Add snake.die() to drop food
        }
    }

    updateSnakeFoodContact(snake) {
        for (let i = 0; i < this.food.length;) {
            if (distance(this.food[i], snake.head) <= snake.radius + this.food[i].radius) {
                this.food.splice(i, 1)
                for (let j = 0; j < this.food[i].amount; j++) {
                    snake.grow()
                }
            } else {
                i += 1
            }
        }
    }

    updateSnakeCollisionContact(snake) {
        let died = false
        for (const targetPlayer in this.snakes) {
            if (targetPlayer === snake.player) { continue }

            const targetSnake = this.snakes[targetPlayer]
            if (targetSnake === null) { continue }

            for (let i = 0; i < targetSnake.parts.length; i++) {
                const part = targetSnake.parts[i]
                if (distance(part, snake.head) <= snake.radius + targetSnake.radius) {  // Might be a problem with side-collisions into the head, but will see
                    died = true
                    break
                }
            }
            if (died) {
                break
            }
        }

        if (!died && snake.head.x - snake.radius < 0 || snake.head.x + snake.radius > mapWidth || snake.head.y - snake.radius < 0 || snake.head.y + snake.radius > mapHeight) {  // Hit border
            died = true
        }

        if (died) {
            this.deaths.push(snake.player)
        }
    }

    updateSnake(player) {
        const snake = this.snakes[player]

        // Speed
        snake.updateSpeed(this.tickCount % Math.round(this.ticksPerSecond / 2) === 0)  // shouldShrink every half-second

        // Position
        snake.updatePosition()

        // Food Contact
        this.updateSnakeFoodContact(snake)

        // Collision Contact
        this.updateSnakeCollisionContact(snake)
    }

    genNewFood() {
        let x = Math.random() * mapWidth
        let y = Math.random() * mapHeight
        this.food.push({x: x, y: y, radius: 5, amount: 1})
    }
}

const gameMaster = new GameMaster()
gameMaster.setupSupabase()
gameMaster.startGame()