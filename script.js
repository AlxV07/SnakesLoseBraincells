const mapWidth = 3000
const mapHeight = 3000


export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.cameraX = 0
        this.cameraY = 0
    }

    moveCamera(x, y) {
        this.cameraX = x;
        this.cameraY = y;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    cameraCtx_moveTo(x, y) {
        this.ctx.moveTo(x - this.cameraX, y - this.cameraY);
    }

    cameraCtx_lineTo(x, y) {
        this.ctx.lineTo(x - this.cameraX, y - this.cameraY);
    }

    cameraCtx_arc(x, y, radius, startAngle, endAngle) {
        this.ctx.arc(x - this.cameraX, y - this.cameraY,radius, startAngle, endAngle);
    }

    cameraCtx_setFillStyle(fillStyle) {
        this.ctx.fillStyle = fillStyle;
    }

    cameraCtx_setStrokeStyle(strokeStyle) {
        this.ctx.strokeStyle = strokeStyle;
    }

    cameraCtx_setTextAlign(textAlign) {
        this.ctx.textAlign = textAlign;
    }

    cameraCtx_setTextBaseline(textBaseline) {
        this.ctx.textBaseline = textBaseline;
    }

    cameraCtx_beginPath() {
        this.ctx.beginPath()
    }

    cameraCtx_fill() {
        this.ctx.fill()
    }

    cameraCtx_stroke() {
        this.ctx.stroke()
    }

    cameraCtx_fillText(text, x, y) {
        this.ctx.fillText(text, x - this.cameraX, y - this.cameraY);
    }

    cameraCtx_setFont(font) {
        this.ctx.font = font
    }
}


// Canvas setup
const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvasCenterX = canvas.width / 2;
    canvasCenterY = canvas.height / 2;
});
let canvasCenterX = canvas.width / 2;
let canvasCenterY = canvas.height / 2;

// Key State setup
const keyState = {}
window.addEventListener('keydown', (e) => { keyState[e.key] = true; });
window.addEventListener('keyup', (e) => { keyState[e.key] = false; })

// Mouse setup
const mouse = {x: canvas.width / 2, y: canvas.height / 2, down: false, direction: 0};
window.addEventListener('mousedown', (e) => { mouse.down = true; })
window.addEventListener('mouseup', (e) => { mouse.down = false; })
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x =  e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.direction = Math.atan2(mouse.y - canvasCenterY, mouse.x - canvasCenterX);
});

// Camera
const camera = new Camera(canvas)


class Client {
    constructor() {
        this.ticksPerSecond = 10
        this.gameInterval = null;

        this.sb = null;

        this.player = null;
        this.playing = false;
        this.snakes = null;
        this.food = null;

        this.connectChannel = null;
        this.dataChannel = null;
        this.stateChannel = null;
    }

    join() {
        // Get Credentials
        const credentials = prompt('Enter Url|Key:')
        const split = credentials.split('|')
        const url = split[0]
        const key = split[1]
        this.sb = supabase.createClient(url, key);

        // Define channels
        this.connectChannel = this.sb.channel('connect')
        this.dataChannel = this.sb.channel('data')
        this.stateChannel = this.sb.channel('spawn')

        // Subscribe to channels
        this.connectChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to connectChannel.') } })
        this.dataChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to dataChannel.') } })
        this.stateChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to spawnChannel.') } })

        // Add listener
        this.dataChannel.on('broadcast', {event: 'update-game'}, (b) => {this.onUpdateGame(b.payload)})

        // Set player name
        this.player = prompt('Enter Player Name:')
        if (this.player === '') {
            throw new Error('Player cannot have an empty name.')
        }
        document.getElementById('spawnButton').textContent = `Spawn: ${this.player}`

        this.connectChannel.send({
            type: 'broadcast',
            event: 'player-joined',
            payload: {player: this.player}
        })
    }

    leave() {
        this.playing = false
        this.connectChannel.send({
            type: 'broadcast',
            event: 'player-left',
            payload: {player: this.player}
        })
    }

    spawnInSnake() {
        this.playing = true
        this.stateChannel.send({
            type: 'broadcast',
            event: 'player-spawned',
            payload: {player: this.player}
        })
        console.log('Player spawned.')
    }

    tick() {
        if (this.playing) {
            this.updatePlayerState()
            document.getElementById('spawnButton').hidden = true
        } else {
            document.getElementById('spawnButton').hidden = undefined
        }
    }

    updatePlayerState() {
        this.stateChannel.send({
            type: 'broadcast',
            event: 'player-state-updated',
            payload: {player: this.player, direction: mouse.direction, mouseDown: mouse.down}
        })
    }

    onUpdateGame(payload) {
        const deaths = payload.deaths
        for (let i = 0; i < deaths.length; i++) {
            const deadPlayer = deaths[i]
            if (deadPlayer === this.player) {
                this.playing = false
            }
        }
        this.snakes = payload.snakes
        this.food = payload.food
        this.drawGame()
    }

    drawGame() {
        if (this.playing) {
            if (this.snakes[this.player] !== null && this.snakes[this.player] !== undefined) {
                camera.moveCamera(this.snakes[this.player].parts[0].x - canvasCenterX, this.snakes[this.player].parts[0].y - canvasCenterY);
            }
        }

        // Clear canvas
        camera.clearCanvas()
        camera.cameraCtx_setFillStyle('#cccccc')
        camera.ctx.fillRect(0, 0, mapWidth, mapHeight);

        // Grid
        camera.cameraCtx_setStrokeStyle('#989898')
        for (let x = 0; x < mapWidth; x += 100) {
            camera.cameraCtx_beginPath()
            camera.cameraCtx_moveTo(x, 0)
            camera.cameraCtx_lineTo(x, mapHeight)
            camera.cameraCtx_stroke()
        }
        for (let y = 0; y < mapHeight; y += 100) {
            camera.cameraCtx_beginPath()
            camera.cameraCtx_moveTo(0, y)
            camera.cameraCtx_lineTo(mapWidth, y)
            camera.cameraCtx_stroke()
        }

        // Food
        camera.cameraCtx_setFillStyle('#30567c');
        this.food.forEach((f) => {
            camera.cameraCtx_beginPath()
            camera.cameraCtx_arc(f.x, f.y, f.radius, 0, Math.PI * 2)
            camera.cameraCtx_fill()
        })

        // Snakes
        for (let targetPlayer in this.snakes) {
            camera.cameraCtx_setFillStyle('#FFF');
            camera.cameraCtx_setStrokeStyle('black')
            const snake = this.snakes[targetPlayer]

            // Parts
            for (let i = snake.parts.length - 1; i > -1; i--) {
                const part = snake.parts[i]
                camera.cameraCtx_beginPath()
                camera.cameraCtx_arc(part.x, part.y, snake.radius, 0, Math.PI * 2)
                camera.cameraCtx_fill()
                camera.cameraCtx_stroke()
            }

            const head = snake.parts[0]

            // Eyes
            camera.cameraCtx_setFillStyle('black')
            camera.cameraCtx_beginPath()
            camera.cameraCtx_arc(head.x + Math.cos(snake.direction+0.8) * 7, head.y + Math.sin(snake.direction+0.8) * 7, snake.radius / 5, 0, Math.PI * 2)
            camera.cameraCtx_fill()
            camera.cameraCtx_beginPath()
            camera.cameraCtx_arc(head.x + Math.cos(snake.direction-0.8) * 7, head.y + Math.sin(snake.direction-0.8) * 7, snake.radius / 5, 0, Math.PI * 2)
            camera.cameraCtx_fill()

            // Name
            camera.cameraCtx_setFillStyle('#003a77')
            camera.cameraCtx_setTextAlign('center')
            camera.cameraCtx_setFont(`20px arial`)
            camera.cameraCtx_setTextBaseline('middle')
            camera.cameraCtx_fillText(targetPlayer, head.x, head.y - snake.radius * 1.3)
        }
    }

    startGame() {
        try {
            this.join()
            window.addEventListener('beforeunload', () => {this.leave()})
            document.getElementById('spawnButton').onclick = () => {this.spawnInSnake()}
            document.getElementById('errorDisplay').hidden = true
            this.gameInterval = setInterval(() => {
                client.tick()
            }, 1000 / this.ticksPerSecond)
        } catch (e) {
            alert(e.toString() + '\n\nReload the page to try again.')
            document.getElementById('spawnButton').hidden = true
            document.getElementById('errorDisplay').textContent = 'Error: ' + e.toString() + ' Reload the page to try again.'
        }
    }
}

const client = new Client()
client.startGame()
