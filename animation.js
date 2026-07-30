export class AnimationEngine {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.numDots = options.numDots || 16;
        this.speedMultiplier = options.speed || 1.2;
        this.dots = [];
        this.isRunning = false;
        this.animationId = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initDots(targetIndex = 0) {
        this.dots = [];
        const radius = 18;
        const padding = 50;

        for (let i = 0; i < this.numDots; i++) {
            let x, y, overlap;
            let safety = 0;
            do {
                overlap = false;
                x = padding + Math.random() * (this.width - 2 * padding);
                y = padding + Math.random() * (this.height - 2 * padding);
                for (let other of this.dots) {
                    const dist = Math.hypot(x - other.x, y - other.y);
                    if (dist < radius * 3) {
                        overlap = true;
                        break;
                    }
                }
                safety++;
            } while (overlap && safety < 100);

            const angle = Math.random() * Math.PI * 2;
            const speed = (1.5 + Math.random() * 2) * this.speedMultiplier;

            this.dots.push({
                id: i,
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: radius,
                isTarget: (i === targetIndex),
                state: 'normal', // 'normal', 'highlight', 'revealed', 'success', 'error'
                pulse: Math.random() * Math.PI
            });
        }
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        let lastTime = performance.now();

        const loop = (time) => {
            if (!this.isRunning) return;
            const dt = (time - lastTime) / 1000;
            lastTime = time;

            this.update(dt);
            this.draw();

            this.animationId = requestAnimationFrame(loop);
        };
        this.animationId = requestAnimationFrame(loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update(dt) {
        for (let dot of this.dots) {
            dot.x += dot.vx;
            dot.y += dot.vy;

            // Bounce off walls
            if (dot.x - dot.radius < 0) {
                dot.x = dot.radius;
                dot.vx *= -1;
            } else if (dot.x + dot.radius > this.width) {
                dot.x = this.width - dot.radius;
                dot.vx *= -1;
            }

            if (dot.y - dot.radius < 0) {
                dot.y = dot.radius;
                dot.vy *= -1;
            } else if (dot.y + dot.radius > this.height) {
                dot.y = this.height - dot.radius;
                dot.vy *= -1;
            }

            // Occasional gentle random steering for organic motion
            if (Math.random() < 0.02) {
                const angleChange = (Math.random() - 0.5) * 0.5;
                const currentAngle = Math.atan2(dot.vy, dot.vx);
                const currentSpeed = Math.hypot(dot.vx, dot.vy);
                const newAngle = currentAngle + angleChange;
                dot.vx = Math.cos(newAngle) * currentSpeed;
                dot.vy = Math.sin(newAngle) * currentSpeed;
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let dot of this.dots) {
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);

            let fillColor = '#ffffff';
            let shadowColor = 'rgba(255, 255, 255, 0.3)';

            if (dot.state === 'highlight') {
                fillColor = '#eab308';
                shadowColor = 'rgba(234, 179, 8, 0.8)';
            } else if (dot.state === 'success') {
                fillColor = '#22c55e';
                shadowColor = 'rgba(34, 197, 94, 0.8)';
            } else if (dot.state === 'error') {
                fillColor = '#ef4444';
                shadowColor = 'rgba(239, 68, 68, 0.8)';
            } else if (dot.state === 'revealed') {
                fillColor = '#eab308';
                shadowColor = 'rgba(234, 179, 8, 0.8)';
            }

            this.ctx.fillStyle = fillColor;
            this.ctx.shadowColor = shadowColor;
            this.ctx.shadowBlur = dot.state !== 'normal' ? 15 : 5;
            this.ctx.fill();
            this.ctx.shadowBlur = 0; // reset
            this.ctx.closePath();
        }
    }

    handleClick(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        for (let dot of this.dots) {
            const dist = Math.hypot(x - dot.x, y - dot.y);
            if (dist <= dot.radius + 5) {
                return dot;
            }
        }
        return null;
    }
}
