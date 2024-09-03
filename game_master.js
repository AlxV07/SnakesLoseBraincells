const mapWidth = 5000
const mapHeight = 5000

function distance(a, b) {return Math.hypot(b.x - a.x, b.y - a.y)}

function convertToPositiveRadian(radian) {
    const twoPi = 2 * Math.PI;
    let positiveRadian = radian % twoPi;
    if (positiveRadian < 0) {
        positiveRadian += twoPi;
    }
    return positiveRadian;
}


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
    constructor(player, color) {
        this.player = player
        this.color = color

        this.radius = 18
        this.parts  = []
        for (let i = 0; i < 5; i++) { this.parts.push({x: 0, y: 0}); }
        this.head = this.parts[0]

        this.speed = 0
        this.normSpeed = 8
        this.sprintSpeed = 16

        this.direction = 0
        this.mouseDown = false

        this.foodCount = 0
    }

    spawn(x, y) {
        for (let i = 0; i < this.parts.length; i++) {
            this.parts[i].x = x
            this.parts[i].y = y
        }
    }

    dataFormat() {
        return {
            radius: this.radius,
            parts: this.parts,
            player: this.player,
            direction: this.direction,
            color: this.color
        }
    }

    updateSpeed(shouldShrink) {
        if (this.mouseDown && this.parts.length > 5) {
            this.speed = this.sprintSpeed
            if (shouldShrink) {
                this.shrink()
            }
        } else {
            this.speed = this.normSpeed
        }
    }

    updatePosition() {
        this.head.x += Math.cos(this.direction) * this.speed;
        this.head.y += Math.sin(this.direction) * this.speed;

        for (let i = this.parts.length - 1; i > 0; i--) {
            const curPart = this.parts[i]
            const nxtPart = this.parts[i - 1]

            const dx = nxtPart.x - curPart.x
            const dy = nxtPart.y - curPart.y

            if (this.speed === this.sprintSpeed) {
                curPart.x += dx
                curPart.y += dy
            } else {
                curPart.x += dx / 2
                curPart.y += dy / 2
            }
        }
    }

    grow() {
        if (this.foodCount % 3 === 0) {
            let a = this.parts[this.parts.length - 1].x;
            let b = this.parts[this.parts.length - 1].y;
            this.parts.push({x: a, y: b})
            this.radius += 0.2
        }
        this.foodCount += 1
    }

    shrink() {
        this.foodCount -= 1
        this.parts.pop()
        this.radius -= 0.2
    }
}


class GameMaster {
    constructor() {
        this.tickCount = 0
        this.ticksPerSecond = 50
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
        // Get Credentials
        const credentials = prompt('Enter Url|Key:')
        const split = credentials.split('|')
        const url1 = split[0]
        const key1 = split[1]
        const url2 = split[2]
        const key2 = split[3]
        this.sb = supabase.createClient(url1, key1);
        this.sb2 = supabase.createClient(url2, key2);

        // Define channels
        this.connectChannel = this.sb.channel('connect')
        this.dataChannel = this.sb2.channel('data')
        this.stateChannel = this.sb.channel('state')

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
        const newSnake = new Snake(player, payload.color)
        newSnake.spawn(Math.min(Math.max(mapWidth / 4, Math.random() * mapWidth), 3 * mapWidth / 4), Math.min(Math.max(mapHeight / 4, Math.random() * mapHeight), 3 * mapHeight / 4))
        this.snakes[player] = newSnake
        console.log(`${player} spawned.`)
    }

    onPlayerStateUpdated(payload) {
        const player = payload.player

        if (this.snakes[player] !== null && this.snakes[player] !== undefined) {
            this.snakes[player].mouseDown = payload.mouseDown

            let tarDir = convertToPositiveRadian(payload.direction)
            let curDir = convertToPositiveRadian(this.snakes[player].direction)

            let d_dir;
            let a = tarDir - curDir;
            let b = (tarDir + 2 * Math.PI) - curDir;
            let c = tarDir - (2 * Math.PI + curDir);
            if (Math.abs(a) < Math.abs(b) && Math.abs(a) < Math.abs(c)) {
                d_dir = a
            } else if (Math.abs(b) < Math.abs(a) && Math.abs(b) < Math.abs(c)) {
                d_dir = b
            } else if (Math.abs(c) < Math.abs(a) && Math.abs(c) < Math.abs(b)) {
                d_dir = c
            }

            if (Math.abs(d_dir) < 0.2)  {
                this.snakes[player].direction = tarDir
            } else {
                this.snakes[player].direction += d_dir / 2
            }
        }
    }

    startGame() {
        this.gameInterval = setInterval(() => {
            this.updateGame()
        }, 1000 / this.ticksPerSecond)
    }

    updateGame() {
        // Clear Deaths
        this.deaths = []

        // Food
        if (this.tickCount % this.ticksPerSecond === 0) {
            this.genNewFood()
        }

        // Snakes
        for (let player in this.snakes) {
            if (this.snakes[player] !== null) {
                this.updateSnake(player)
            }
        }

        // Kill dead snakes
        this.killDeadSnakes()

        // Broadcast
        this.broadcastData()

        // Log Tick Count
        if (this.tickCount % (this.ticksPerSecond * 5) === 0) {
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
            for (let j = 0; j < this.snakes[player].parts.length; j++) {
                const part = this.snakes[player].parts[j]
                this.food.push({x: part.x, y: part.y, radius: 11, amount: 2, color: this.snakes[player].color})
            }
            this.snakes[player] = null
        }
    }

    updateSnakeFoodContact(snake) {
        for (let i = 0; i < this.food.length;) {
            if (distance(this.food[i], snake.head) <= snake.radius + this.food[i].radius * 1.5) {
                this.food.splice(i, 1)
                for (let j = 0; j < this.food[i].amount; j++) {
                    snake.grow()
                }
            } else {
                i += 1
            }
        }
    }

    updateSnakeCollisionContact(player, snake) {
        let died = false
        for (const targetPlayer in this.snakes) {
            if (targetPlayer === player) { continue }

            const targetSnake = this.snakes[targetPlayer]
            if (targetSnake === null) { continue }

            for (let i = 0; i < targetSnake.parts.length; i++) {
                const part = targetSnake.parts[i]
                if (distance(part, snake.head) <= snake.radius + targetSnake.radius) {  // Might be a problem with side-collisions into the head, but will see
                    died = true
                    console.log(`${player} slid into ${targetPlayer} and died.`)
                    break
                }
            }
            if (died) {
                break
            }
        }

        if (!died && snake.head.x - snake.radius < 0 || snake.head.x + snake.radius > mapWidth || snake.head.y - snake.radius < 0 || snake.head.y + snake.radius > mapHeight) {  // Hit border
            died = true
            console.log(`${player} slid into the border and died.`)
        }

        if (died) {
            this.deaths.push(player)
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
        this.updateSnakeCollisionContact(player, snake)
    }

    genNewFood() {
        let x = Math.random() * mapWidth
        let y = Math.random() * mapHeight
        let color = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'white'][Math.round(Math.random() * 7)]
        if (this.food.length > 1000) {
            for (let i = 0; i < 10; i++) {
                this.food.shift()
            }
        } else {
            this.food.push({x: x, y: y, radius: 7, amount: 1, color: color})
        }
    }
}

const gameMaster = new GameMaster()
gameMaster.setupSupabase()
gameMaster.startGame()
