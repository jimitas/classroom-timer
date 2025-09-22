let timerInterval = null;
let totalSeconds = 0;
let isRunning = false;
let isPaused = false;
let originalTitle = document.title;

// モード管理
let currentMode = 'timer'; // 'timer' or 'stopwatch'
let stopwatchStartTime = null;
let stopwatchElapsed = 0;
let showTenths = false;

// 音声通知用
let audioContext = null;

// 効果音ファイル
let soundEffects = {};

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// 効果音を事前に読み込み
function preloadSounds() {
    const sounds = {
        reset: 'sound/reset.mp3',
        start: 'sound/right.mp3',
        complete: 'sound/seikai.mp3',
        button: 'sound/set.mp3',
        alert: 'sound/alert.mp3'
    };

    Object.keys(sounds).forEach(key => {
        soundEffects[key] = new Audio(sounds[key]);
        soundEffects[key].preload = 'auto';
        soundEffects[key].volume = 0.7;

        // iOS Safari対応: ユーザーインタラクション後に準備
        soundEffects[key].load();
    });
}

// 効果音を再生
function playSound(soundName) {
    if (soundEffects[soundName]) {
        try {
            soundEffects[soundName].currentTime = 0;
            soundEffects[soundName].play().catch(error => {
                console.log('Sound play failed:', error);
            });
        } catch (error) {
            console.log('Sound play error:', error);
        }
    }
}

function playBeep(frequency = 800, duration = 200) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

// モード切り替え
function switchToTimer() {
    playSound('button');

    if (isRunning) {
        if (currentMode === 'stopwatch') {
            // 音なしでストップウォッチを停止
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        } else {
            // 音なしでタイマーを停止
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
    }

    isRunning = false;
    isPaused = false;

    currentMode = 'timer';
    document.getElementById('timerModeBtn').classList.add('active');
    document.getElementById('stopwatchModeBtn').classList.remove('active');
    document.getElementById('timerSection').style.display = 'block';
    document.getElementById('stopwatchSection').style.display = 'none';

    // h1タイトルを変更
    document.querySelector('.app-title').textContent = '⏰ タイマー';

    // 背景色をタイマー用に変更
    document.body.classList.remove('stopwatch-mode');
    document.body.classList.add('timer-mode');

    // ボタン状態をリセット（音なし）
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('timerDisplay').classList.remove('warning');

    document.title = originalTitle;
    totalSeconds = 0;

    document.getElementById('minutes').value = 0;
    document.getElementById('seconds').value = 0;

    updateDisplay();
}

function switchToStopwatch() {
    playSound('button');

    if (isRunning) {
        if (currentMode === 'timer') {
            // 音なしでタイマーを停止
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        } else {
            // 音なしでストップウォッチを停止
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
    }

    isRunning = false;
    isPaused = false;

    currentMode = 'stopwatch';
    document.getElementById('timerModeBtn').classList.remove('active');
    document.getElementById('stopwatchModeBtn').classList.add('active');
    document.getElementById('timerSection').style.display = 'none';
    document.getElementById('stopwatchSection').style.display = 'block';

    // h1タイトルを変更
    document.querySelector('.app-title').textContent = '⏱️ ストップウォッチ';

    // 背景色をストップウォッチ用に変更
    document.body.classList.remove('timer-mode');
    document.body.classList.add('stopwatch-mode');

    // ボタン状態をリセット（音なし）
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';

    document.title = originalTitle;
    stopwatchElapsed = 0;
    updateStopwatchDisplay();
}

// 精度切り替え
function togglePrecision() {
    playSound('button');
    showTenths = document.getElementById('precisionToggle').checked;
    if (currentMode === 'stopwatch' && !isRunning) {
        updateStopwatchDisplay();
    }
}

// 統合アクション
function startAction() {
    if (currentMode === 'timer') {
        startTimer();
    } else {
        startStopwatch();
    }
}

function pauseAction() {
    if (currentMode === 'timer') {
        pauseTimer();
    } else {
        pauseStopwatch();
    }
}

function stopAction() {
    if (currentMode === 'timer') {
        stopTimer();
    } else {
        stopStopwatch();
    }
}

function resetAction() {
    if (currentMode === 'timer') {
        resetTimer();
    } else {
        resetStopwatch();
    }
}


function updateDisplay() {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const display = `${minutes.toString().padStart(2, '0')}分${seconds.toString().padStart(2, '0')}秒`;

    document.getElementById('timerDisplay').textContent = display;
    document.title = `${display} - ${originalTitle}`;

    // 残り30秒以下で警告表示
    if (totalSeconds <= 30 && totalSeconds > 0 && isRunning && currentMode === 'timer') {
        document.getElementById('timerDisplay').classList.add('warning');
    } else {
        document.getElementById('timerDisplay').classList.remove('warning');
    }
}

function startTimer() {
    initAudio();

    // カスタム設定から時間を取得
    const minutes = parseInt(document.getElementById('minutes').value) || 0;
    const seconds = parseInt(document.getElementById('seconds').value) || 0;

    if (!isPaused) {
        totalSeconds = minutes * 60 + seconds;
    }

    if (totalSeconds <= 0) {
        playSound('alert');
        alert('⚠️ 時間を設定してください');
        return;
    }

    playSound('start');
    isRunning = true;
    isPaused = false;

    // ボタンの表示切り替え
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'inline-block';

    timerInterval = setInterval(() => {
        totalSeconds--;
        updateDisplay();

        // 残り時間の音声通知
        if (totalSeconds === 30 || totalSeconds === 10 || totalSeconds === 5) {
            playBeep(600, 150);
        }

        if (totalSeconds <= 0) {
            // タイマー終了
            stopTimer();
            playSound('complete');
            showTimeUpNotification();
        }
    }, 1000);
}

function pauseTimer() {
    playSound('button');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = true;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ 再開';
    document.getElementById('pauseBtn').style.display = 'none';
}

function stopTimer() {
    playSound('button');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = false;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('timerDisplay').classList.remove('warning');

    document.title = originalTitle;
}

function resetTimer() {
    playSound('reset');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = false;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('timerDisplay').classList.remove('warning');

    document.title = originalTitle;
    totalSeconds = 0;

    document.getElementById('minutes').value = 0;
    document.getElementById('seconds').value = 0;

    updateDisplay();
}

// ストップウォッチ機能
function updateStopwatchDisplay() {
    const totalMs = stopwatchElapsed;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const tenths = Math.floor((totalMs % 1000) / 100);

    let display;
    let titleDisplay;
    if (showTenths) {
        display = `${minutes.toString().padStart(2, '0')}分${seconds.toString().padStart(2, '0')}.${tenths}秒`;
        titleDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`;
    } else {
        display = `${minutes.toString().padStart(2, '0')}分${seconds.toString().padStart(2, '0')}秒`;
        titleDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    document.getElementById('timerDisplay').textContent = display;
    document.title = `${display} - ${originalTitle}`;
}

function startStopwatch() {
    playSound('start');
    initAudio();

    if (!isPaused) {
        stopwatchElapsed = 0;
    }

    stopwatchStartTime = Date.now() - stopwatchElapsed;
    isRunning = true;
    isPaused = false;

    // ボタンの表示切り替え
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'inline-block';

    const updateInterval = showTenths ? 100 : 1000;

    timerInterval = setInterval(() => {
        stopwatchElapsed = Date.now() - stopwatchStartTime;
        updateStopwatchDisplay();
    }, updateInterval);
}

function pauseStopwatch() {
    playSound('button');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = true;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ 再開';
    document.getElementById('pauseBtn').style.display = 'none';
}

function stopStopwatch() {
    playSound('button');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = false;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';

    document.title = originalTitle;
}

function resetStopwatch() {
    playSound('reset');
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    isRunning = false;
    isPaused = false;

    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('startBtn').textContent = '▶️ スタート';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';

    document.title = originalTitle;
    stopwatchElapsed = 0;
    updateStopwatchDisplay();
}

function playEndSound() {
    // 終了音（3回のビープ音）
    playBeep(800, 300);
    setTimeout(() => playBeep(800, 300), 400);
    setTimeout(() => playBeep(800, 500), 800);
}

function showTimeUpNotification() {
    // ブラウザ通知
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ タイマー終了', {
            body: '設定した時間が経過しました！',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>'
        });
    }

    // 画面での通知
    alert('⏰ 時間です！\n\nタイマーが終了しました。');
}


// 通知許可の要求
document.addEventListener('DOMContentLoaded', function() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // 効果音を事前に読み込み
    preloadSounds();

    // 初期モード設定
    document.body.classList.add('timer-mode');

    if (currentMode === 'timer') {
        updateDisplay();
    } else {
        updateStopwatchDisplay();
    }
});

// キーボードショートカット
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        e.preventDefault();
        if (isRunning) {
            pauseAction();
        } else {
            startAction();
        }
    }

    if (e.code === 'Escape') {
        stopAction();
    }

    if (e.key === 'r' || e.key === 'R') {
        resetAction();
    }


    // モード切り替えショートカット
    if (e.key === 't' || e.key === 'T') {
        switchToTimer();
    }

    if (e.key === 's' || e.key === 'S') {
        switchToStopwatch();
    }
});

// 入力フィールドでエンターキーを押したら開始
['minutes', 'seconds'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            startTimer();
        }
    });
});