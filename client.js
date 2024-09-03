const mapWidth = 5000
const mapHeight = 5000


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

// Game Master Button
document.getElementById('switchToGameMaster').onclick = () => {
    const iframe = document.createElement('iframe')
    iframe.src = 'game_master.html'
    iframe.style.position = 'absolute'
    iframe.style.top = '50%'
    iframe.style.left = '50%'
    iframe.style.height = '500px'
    iframe.style.transform = 'translate(-50%, -50%)'
    document.body.removeChild(document.getElementById('joinContainer'))
    document.body.removeChild(document.getElementById('spawnContainer'))
    document.body.appendChild(iframe)
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
        this.ticksPerSecond = 25
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
        const credentials = document.getElementById('credentialsInput').value
        const split = credentials.split('|')
        const url1 = split[0]
        const key1 = split[1]
        const url2 = split[2]
        const key2 = split[3]
        this.sb = supabase.createClient(url1, key1);
        this.sb2 = supabase.createClient(url2, key2);

        // Set player name
        this.player = document.getElementById('playerNameInput').value
        if (this.player === '') { throw new Error('Player cannot have an empty name.') }

        // Define channels
        this.connectChannel = this.sb.channel('connect')
        this.dataChannel = this.sb2.channel('data')
        this.stateChannel = this.sb.channel('state')

        // Subscribe to channels
        this.connectChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to connectChannel.') } })
        this.dataChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to dataChannel.') } })
        this.stateChannel.subscribe((status) => { if (status === 'SUBSCRIBED') { console.log('Client subscribed to spawnChannel.') } })

        // Add listener
        this.dataChannel.on('broadcast', {event: 'update-game'}, (b) => {this.onUpdateGame(b.payload)})

        document.body.removeChild(document.getElementById('joinContainer'))

        document.getElementById('spawnButton').textContent = `Spawn: ${this.player}`
        window.addEventListener('beforeunload', () => {this.leave()})
        document.getElementById('spawnButton').onclick = () => { this.spawnInSnake(); }
        this.gameInterval = setInterval(() => { client.tick() }, 1000 / this.ticksPerSecond)

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
            payload: {player: this.player, color: document.getElementById('spawnButton').style.color}
        })
        console.log('Player spawned.')
    }

    tick() {
        if (this.playing) {
            this.updatePlayerState()
            document.getElementById('spawnButton').hidden = true
            document.getElementById('colorBar').hidden = true
            for (let i = 0; i < document.getElementById('colorBar').children.length; i++) {
                document.getElementById('colorBar').children[i].hidden = true
            }
        } else {
            document.getElementById('spawnButton').hidden = undefined
            document.getElementById('colorBar').hidden = undefined
            for (let i = 0; i < document.getElementById('colorBar').children.length; i++) {
                document.getElementById('colorBar').children[i].hidden = undefined
            }
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

        // Grid & Border
        camera.cameraCtx_setStrokeStyle('#989898')
        for (let x = 0; x < mapWidth; x += 100) {
            if (x === 0) { camera.cameraCtx_setStrokeStyle('#8a0000') } else { camera.cameraCtx_setStrokeStyle('#989898') }
            camera.cameraCtx_beginPath()
            camera.cameraCtx_moveTo(x, 0)
            camera.cameraCtx_lineTo(x, mapHeight)
            camera.cameraCtx_stroke()
        }
        camera.cameraCtx_setStrokeStyle('#8a0000')
        camera.cameraCtx_beginPath(); camera.cameraCtx_moveTo(mapWidth, 0)
        camera.cameraCtx_lineTo(mapWidth, mapHeight); camera.cameraCtx_stroke()
        for (let y = 0; y < mapHeight; y += 100) {
            if (y === 0) { camera.cameraCtx_setStrokeStyle('#8a0000') } else { camera.cameraCtx_setStrokeStyle('#989898') }
            camera.cameraCtx_beginPath()
            camera.cameraCtx_moveTo(0, y)
            camera.cameraCtx_lineTo(mapWidth, y)
            camera.cameraCtx_stroke()
        }
        camera.cameraCtx_setStrokeStyle('#8a0000')
        camera.cameraCtx_beginPath(); camera.cameraCtx_moveTo(0, mapHeight)
        camera.cameraCtx_lineTo(mapWidth, mapHeight); camera.cameraCtx_stroke()

        // Food
        this.food.forEach((f) => {
            camera.cameraCtx_beginPath()
            camera.cameraCtx_arc(f.x, f.y, f.radius, 0, Math.PI * 2)
            camera.cameraCtx_setFillStyle(f.color)
            camera.cameraCtx_fill()
        })

        // Snakes
        for (let targetPlayer in this.snakes) {
            const snake = this.snakes[targetPlayer]
            camera.cameraCtx_setFillStyle(snake.color);
            camera.cameraCtx_setStrokeStyle('black')

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
            let s = snake.radius / 2
            camera.cameraCtx_setFillStyle('black')
            camera.cameraCtx_beginPath()
            let x1 = snake.direction + 0.8;
            camera.cameraCtx_arc(head.x + Math.cos(x1) * s, head.y + Math.sin(x1) * s, snake.radius / 5, 0, Math.PI * 2)
            camera.cameraCtx_fill()
            camera.cameraCtx_beginPath()
            let x2 = snake.direction-0.8;
            camera.cameraCtx_arc(head.x + Math.cos(x2) * s, head.y + Math.sin(x2) * s, snake.radius / 5, 0, Math.PI * 2)
            camera.cameraCtx_fill()

            // Name
            camera.cameraCtx_setFillStyle('#003a77')
            camera.cameraCtx_setTextAlign('center')
            camera.cameraCtx_setFont(`20px arial`)
            camera.cameraCtx_setTextBaseline('middle')
            camera.cameraCtx_fillText(targetPlayer, head.x, head.y - snake.radius * 1.3)
        }
    }
}

const client = new Client()
document.getElementById('joinButton').onclick = () => { client.join() }

// Color bar
const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet', 'white'];
const colorBar = document.getElementById('colorBar');
colorBar.style.display = 'flex';
colorBar.style.flexDirection = 'row'
colors.forEach(color => {
    const circle = document.createElement('div');
    circle.style.backgroundColor = color;
    circle.style.width = "20px"
    circle.style.height = "20px"
    circle.style.borderRadius = '10px'
    circle.style.marginRight = "10px"
    circle.style.cursor = "pointer"
    circle.addEventListener('click', () => {
        document.getElementById('spawnButton').style.color = color
    });
    colorBar.appendChild(circle);
});
