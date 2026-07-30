import { SoloGame } from './solo.js';
import { OnlineManager } from './online.js';
import { audio } from './audio.js';

class AppController {
    constructor() {
        this.currentScreen = 'screen-menu';
        this.soloGame = null;
        this.onlineManager = new OnlineManager(this);
        this.stats = {
            totalGames: 0,
            wins: 0,
            precisionSum: 0,
            bestStreak: 0
        };
        this.loadStats();
        this.initListeners();
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
        this.currentScreen = screenId;
    }

    initListeners() {
        // Menu navigation
        document.getElementById('btn-solo').onclick = () => {
            audio.playClick();
            this.showScreen('screen-solo-setup');
        };
        document.getElementById('btn-online').onclick = () => {
            audio.playClick();
            this.showScreen('screen-online');
            this.onlineManager.init();
        };
        document.getElementById('btn-stats').onclick = () => {
            audio.playClick();
            this.updateStatsUI();
            this.showScreen('screen-stats');
        };
        document.getElementById('btn-rules').onclick = () => {
            audio.playClick();
            this.showScreen('screen-rules');
        };
        document.getElementById('btn-settings').onclick = () => {
            audio.playClick();
            this.showScreen('screen-settings');
        };

        // Back buttons
        document.getElementById('btn-solo-back').onclick = () => { audio.playClick(); this.showScreen('screen-menu'); };
        document.getElementById('btn-stats-back').onclick = () => { audio.playClick(); this.showScreen('screen-menu'); };
        document.getElementById('btn-rules-back').onclick = () => { audio.playClick(); this.showScreen('screen-menu'); };
        document.getElementById('btn-settings-back').onclick = () => { audio.playClick(); this.showScreen('screen-menu'); };

        // Pill selectors helper
        this.setupPillSelectors();

        // Solo start
        document.getElementById('btn-solo-start').onclick = () => {
            audio.playClick();
            const numDots = parseInt(document.querySelector('#select-dots .pill.active').dataset.val);
            const speed = parseFloat(document.querySelector('#select-speed .pill.active').dataset.val);
            const obsTime = parseInt(document.querySelector('#select-time .pill.active').dataset.val);

            this.showScreen('screen-game');
            this.startSoloGame({ numDots, speed, obsTime });
        };

        // In-game top buttons
        document.getElementById('btn-home').onclick = () => {
            audio.playClick();
            if (this.soloGame) this.soloGame.stop();
            this.showScreen('screen-menu');
        };
        document.getElementById('btn-pause-toggle').onclick = () => {
            audio.playClick();
            if (this.soloGame) this.soloGame.stop();
            document.getElementById('modal-pause').classList.remove('hidden');
        };
        document.getElementById('btn-quit').onclick = () => {
            audio.playClick();
            if (this.soloGame) this.soloGame.stop();
            this.showScreen('screen-menu');
        };

        // Pause modal buttons
        document.getElementById('btn-resume').onclick = () => {
            audio.playClick();
            document.getElementById('modal-pause').classList.add('hidden');
            if (this.soloGame) this.soloGame.engine.start();
        };
        document.getElementById('btn-abandon').onclick = () => {
            audio.playClick();
            document.getElementById('modal-pause').classList.add('hidden');
            if (this.soloGame) this.soloGame.stop();
            this.showScreen('screen-menu');
        };

        // Settings toggles
        document.getElementById('setting-music').onchange = (e) => {
            audio.musicEnabled = e.target.checked;
        };
        document.getElementById('setting-sfx').onchange = (e) => {
            audio.sfxEnabled = e.target.checked;
        };
    }

    setupPillSelectors() {
        document.querySelectorAll('.pill-selector').forEach(selector => {
            selector.querySelectorAll('.pill').forEach(pill => {
                pill.onclick = () => {
                    audio.playClick();
                    selector.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                };
            });
        });
    }

    startOnlineRound(config, context) {
        if (this.soloGame) this.soloGame.stop();

        this.showScreen('screen-game');
        document.getElementById('info-status').textContent = 'Manche en ligne...';

        // Réutilisation directe de SoloGame : même moteur, mêmes règles,
        // seule la fin de partie est synchronisée dans Firebase.
        this.soloGame = new SoloGame(config, async (score, levels) => {
            this.recordGameStats(score, levels);
            await this.onlineManager.submitResult(score, levels, context.roundId);
            document.getElementById('info-status').textContent = 'Résultat envoyé. En attente des autres joueurs...';
        });
        this.soloGame.startRound();
    }

    showOnlineResults(players, hostName) {
        if (this.soloGame) this.soloGame.stop();

        const ranking = Object.entries(players)
            .map(([name, data]) => ({
                name,
                score: Number(data.score || 0),
                levels: Number(data.levels || 0)
            }))
            .sort((a, b) => b.score - a.score || b.levels - a.levels || a.name.localeCompare(b.name));

        const lines = ranking.map((player, index) =>
            `${index + 1}. ${player.name} — ${player.score} points (${player.levels} niveau${player.levels > 1 ? 'x' : ''})`
        );

        document.getElementById('info-level').textContent = 'Résultats en ligne';
        document.getElementById('info-score').textContent = ranking[0] ? `Vainqueur : ${ranking[0].name}` : '';
        document.getElementById('info-status').textContent = lines.join(' | ');
        document.getElementById('btn-stop').classList.add('hidden');

        // Retour au salon après lecture des résultats.
        setTimeout(() => {
            this.showScreen('screen-online');
            document.getElementById('lobby-menu').classList.add('hidden');
            document.getElementById('lobby-room').classList.remove('hidden');
            document.getElementById('host-name').textContent = hostName || 'Salon';
        }, 5000);
    }

    startSoloGame(config) {
        this.soloGame = new SoloGame(config, (score, levels) => {
            this.recordGameStats(score, levels);
        });
        this.soloGame.startRound();
    }

    recordGameStats(score, levels) {
        this.stats.totalGames++;
        if (levels > 0) this.stats.wins++;
        if (levels > this.stats.bestStreak) this.stats.bestStreak = levels;
        this.saveStats();
    }

    loadStats() {
        const saved = localStorage.getItem('yellow_dot_stats');
        if (saved) {
            try { this.stats = JSON.parse(saved); } catch(e){}
        }
    }

    saveStats() {
        localStorage.setItem('yellow_dot_stats', JSON.stringify(this.stats));
    }

    updateStatsUI() {
        const precision = this.stats.totalGames > 0 ? Math.round((this.stats.wins / this.stats.totalGames) * 100) : 0;
        document.getElementById('stat-precision').textContent = `${precision}%`;
        document.getElementById('stat-avg-time').textContent = `2.1s`;
        document.getElementById('stat-streak').textContent = this.stats.bestStreak;
        document.getElementById('stat-wins').textContent = this.stats.wins;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new AppController();
});
