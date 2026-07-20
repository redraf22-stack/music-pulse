// visualizer.js
(function() {
    const audio = document.querySelector('audio');
    if (!audio) return;

    let audioContext, analyser, dataArray, source;
    let animationId;
    const rootStyles = getComputedStyle(document.documentElement);
    const accentColor = rootStyles.getPropertyValue('--accent').trim() || '#1db954';

    function initVisualizer() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            animate();
        } catch (e) {
            console.error('Visualizer init failed:', e);
        }
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        if (!analyser || audio.paused) {
            document.documentElement.style.setProperty('--pulse-glow', 'none');
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.style.boxShadow = 'none';
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const intensity = Math.min(average / 60, 1); 

        if (intensity < 0.05) {
            document.documentElement.style.setProperty('--pulse-glow', 'none');
            return;
        }

        const glowSize = 4 + (intensity * 12);
        const pulseGlow = `0 0 ${glowSize}px ${accentColor}, 0 0 ${glowSize * 2}px ${accentColor}40`;
        document.documentElement.style.setProperty('--pulse-glow', pulseGlow);
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.boxShadow = `inset -4px 0 ${glowSize}px -2px ${accentColor}`;
        }
    }

    audio.addEventListener('play', () => {
        if (audioContext && audioContext.state === 'suspended') audioContext.resume();
        else initVisualizer();
    });
    
    audio.addEventListener('pause', () => {
        document.documentElement.style.setProperty('--pulse-glow', 'none');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.boxShadow = 'none';
    });
})();