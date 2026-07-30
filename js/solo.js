import { AnimationEngine } from './animation.js';
import { audio } from './audio.js';

export class SoloGame {
    constructor(config, onGameOver) {
        this.config = config; // { numDots, speed, obsTime }
        this.onGameOver = onGameOver;
        this.canvas = document.getElementById('game-canvas');
        this.engine = new AnimationEngine(this.canvas, {
            numDots: config.numDots,
            speed: config.speed
        });

        this.level = 1;
        this.score = 0;
        this.state = 'observing'; // 'observing', 'moving', 'waiting_stop', 'result'
        this.timer = null;

        this.setupUI();
    }

    setupUI() {
        const btnStop = document.getElementById('btn-stop');
        btnStop.classList.add('hidden');
        
        // Remove old listeners by cloning
        const newBtnStop = btnStop.cloneNode(true);
        btnStop.parentNode.replaceChild(newBtnStop, btnStop);
        
        document.getElementById('btn-stop').addEventListener('click', () => this.handleStop());
        
        const newCanvas = this.canvas.cloneNode(true);
        this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.engine.canvas = this.canvas;
        // Le canvas visible vient d'être remplacé : il faut aussi recréer
        // son contexte de dessin et recalculer ses dimensions.
        this.engine.ctx = this.canvas.getContext('2d');
        this.engine.resize();

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    startRound() {
        this.state = 'observing';
        document.getElementById('info-level').textContent = `Niveau : ${this.level}`;
        document.getElementById('info-score').textContent = `Score : ${this.score}`;
        document.getElementById('info-status').textContent = 'Observez le point jaune...';
        document.getElementById('btn-stop').classList.add('hidden');

        // Choose random target
        const targetIndex = Math.floor(Math.random() * this.config.numDots);
        this.engine.initDots(targetIndex);
        
        // Highlight target
        for (let dot of this.engine.dots) {
            if (dot.id === targetIndex) {
                dot.state = 'highlight';
            }
        }

        this.engine.start();

        // Observation timeout
        setTimeout(() => {
            if (!this.engine.isRunning) return;
            // Remove highlight
            for (let dot of this.engine.dots) {
                if (dot.state === 'highlight') {
                    dot.state = 'normal';
                }
            }
            this.state = 'moving';
            document.getElementById('info-status').textContent = 'Suivez les points du regard...';
            document.getElementById('btn-stop').classList.remove('hidden');
        }, this.config.obsTime * 1000);
    }

    handleStop() {
        if (this.state !== 'moving') return;
        this.state = 'waiting_stop';
        this.engine.stop();
        document.getElementById('btn-stop').classList.add('hidden');
        document.getElementById('info-status').textContent = 'Cliquez sur le bon point !';
    }

    handleCanvasClick(e) {
        if (this.state !== 'waiting_stop') return;

        const clickedDot = this.engine.handleClick(e.clientX, e.clientY);
        if (!clickedDot) return;

        this.state = 'result';
        
        // Find true target
        let trueTarget = null;
        for (let dot of this.engine.dots) {
            if (dot.isTarget) {
                trueTarget = dot;
                break;
            }
        }

        if (clickedDot.isTarget) {
            audio.playSuccess();
            clickedDot.state = 'success';
            this.score += 10 * this.level;
            this.level += 1;
            document.getElementById('info-status').textContent = 'Victoire ! Niveau suivant...';
            this.engine.start();
            setTimeout(() => {
                this.engine.stop();
                this.startRound();
            }, 1200);
        } else {
            audio.playError();
            clickedDot.state = 'error';
            if (trueTarget) trueTarget.state = 'revealed';
            this.engine.start();
            document.getElementById('info-status').textContent = 'Défaite ! Mauvais point.';
            setTimeout(() => {
                this.engine.stop();
                if (this.onGameOver) this.onGameOver(this.score, this.level - 1);
            }, 2000);
        }
    }

    stop() {
        this.engine.stop();
    }
}
