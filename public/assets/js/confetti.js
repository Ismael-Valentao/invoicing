function launchConfetti() {
    confetti({
        particleCount: 1000,
        spread: 100,
        origin: { y: 0.8 },
        colors: ['#228CDF', '#28a745', '#ffffff', '#ff0000']
    });
}