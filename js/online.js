import { db } from '../firebase/firebase-config.js';
import { ref, set, get, push, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { audio } from './audio.js';

export class OnlineManager {
    constructor(appController) {
        this.app = appController;
        this.username = '';
        this.roomId = null;
        this.isHost = false;
        this.unsubRoom = null;
        this.unsubRoomsList = null;
        this.activeRoundId = null;
        this.resultsShownForRound = null;
    }

    init() {
        const btnLogin = document.getElementById('btn-login-online');
        const btnCreate = document.getElementById('btn-create-room');
        const btnLeave = document.getElementById('btn-leave-room');
        const btnBack = document.getElementById('btn-online-back');
        const btnStart = document.getElementById('btn-start-room');

        btnLogin.onclick = () => {
            const val = document.getElementById('input-username').value.trim();
            if (val) {
                this.username = val;
                document.getElementById('lobby-auth').classList.add('hidden');
                document.getElementById('lobby-menu').classList.remove('hidden');
                this.listenRooms();
            }
        };

        btnCreate.onclick = () => this.createRoom();
        btnLeave.onclick = () => this.leaveRoom();

        // Le bouton n'avait aucun gestionnaire : il déclenche maintenant
        // le lancement synchronisé de la manche pour tous les joueurs.
        btnStart.onclick = () => {
            audio.playClick();
            this.requestStartRound();
        };

        btnBack.onclick = () => {
            if (this.unsubRoomsList) this.unsubRoomsList();
            this.leaveRoom();
            this.app.showScreen('screen-menu');
        };
    }

    listenRooms() {
        const roomsRef = ref(db, 'rooms');
        if (this.unsubRoomsList) this.unsubRoomsList();
        this.unsubRoomsList = onValue(roomsRef, (snapshot) => {
            const data = snapshot.val();
            const listEl = document.getElementById('room-list');
            listEl.innerHTML = '';
            if (!data) {
                listEl.innerHTML = '<p>Aucun salon disponible.</p>';
                return;
            }
            for (const id in data) {
                const room = data[id];
                if (room.status === 'waiting') {
                    const div = document.createElement('div');
                    div.className = 'room-item';
                    div.innerHTML = `<span>Salon de ${room.host}</span><span>Rejoindre ➔</span>`;
                    div.onclick = () => this.joinRoom(id);
                    listEl.appendChild(div);
                }
            }
        });
    }

    createRoom() {
        const newRoomRef = push(ref(db, 'rooms'));
        this.roomId = newRoomRef.key;
        this.isHost = true;

        const roomData = {
            host: this.username,
            status: 'waiting',
            createdAt: Date.now(),
            players: {
                [this.username]: { score: 0, levels: 0, ready: true, finished: false }
            }
        };

        set(newRoomRef, roomData).then(() => {
            this.enterRoomUI();
            this.listenRoomData();
        });
    }

    joinRoom(roomId) {
        this.roomId = roomId;
        this.isHost = false;
        const playerRef = ref(db, `rooms/${roomId}/players/${this.username}`);
        set(playerRef, { score: 0, levels: 0, ready: true, finished: false }).then(() => {
            this.enterRoomUI();
            this.listenRoomData();
        });
    }

    enterRoomUI() {
        document.getElementById('lobby-menu').classList.add('hidden');
        document.getElementById('lobby-room').classList.remove('hidden');
        document.getElementById('host-name').textContent = this.isHost ? this.username : 'Salon';
        document.getElementById('btn-start-room').classList.toggle('hidden', !this.isHost);
    }

    async requestStartRound() {
        if (!this.isHost || !this.roomId) return;

        const roomSnapshot = await get(ref(db, `rooms/${this.roomId}`));
        const room = roomSnapshot.val();
        if (!room || room.status === 'playing') return;

        const roundId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const updates = {
            status: 'playing',
            round: {
                id: roundId,
                startedAt: Date.now(),
                config: { numDots: 16, speed: 1.2, obsTime: 2 }
            }
        };

        for (const playerName of Object.keys(room.players || {})) {
            updates[`players/${playerName}/score`] = 0;
            updates[`players/${playerName}/levels`] = 0;
            updates[`players/${playerName}/finished`] = false;
        }

        update(ref(db, `rooms/${this.roomId}`), updates);
    }

    listenRoomData() {
        const roomRef = ref(db, `rooms/${this.roomId}`);
        if (this.unsubRoom) this.unsubRoom();

        this.unsubRoom = onValue(roomRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            const playersUl = document.getElementById('players-ul');
            playersUl.innerHTML = '';
            if (data.players) {
                for (const playerName in data.players) {
                    const player = data.players[playerName];
                    const li = document.createElement('li');
                    const suffix = player.finished ? ` — ${player.score || 0} pts` : '';
                    li.textContent = `• ${playerName}${suffix}`;
                    playersUl.appendChild(li);
                }
            }

            const roundId = data.round?.id;
            if (data.status === 'playing' && roundId && this.activeRoundId !== roundId) {
                this.activeRoundId = roundId;
                this.resultsShownForRound = null;
                this.app.startOnlineRound(data.round.config, {
                    roomId: this.roomId,
                    username: this.username,
                    roundId
                });
            }

            if (this.isHost && data.status === 'playing' && roundId && data.players) {
                const players = Object.values(data.players);
                if (players.length > 0 && players.every(player => player.finished === true)) {
                    update(roomRef, { status: 'results', endedAt: Date.now() });
                }
            }

            if (data.status === 'results' && roundId && this.resultsShownForRound !== roundId) {
                this.resultsShownForRound = roundId;
                this.app.showOnlineResults(data.players || {}, data.host);
            }
        });
    }

    async submitResult(score, levels, roundId) {
        if (!this.roomId || !this.username || roundId !== this.activeRoundId) return;

        await update(ref(db, `rooms/${this.roomId}/players/${this.username}`), {
            score,
            levels,
            finished: true,
            finishedAt: Date.now()
        });

        // Le listener du salon côté hôte détecte automatiquement
        // quand tous les joueurs ont terminé.
    }

    leaveRoom() {
        if (this.unsubRoom) {
            this.unsubRoom();
            this.unsubRoom = null;
        }
        if (this.roomId && this.username) {
            remove(ref(db, `rooms/${this.roomId}/players/${this.username}`));
            this.roomId = null;
        }
        this.activeRoundId = null;
        document.getElementById('lobby-room').classList.add('hidden');
        document.getElementById('lobby-menu').classList.remove('hidden');
    }
}
