window.addEventListener('load', () => {
    // Fallback: Show everything if GSAP fails
    if (!window.gsap) {
        document.querySelectorAll('.gsap-reveal').forEach(el => el.style.opacity = '1');
        return;
    }

    // Set to 1 so GSAP captured the correct target state
    gsap.set('.gsap-reveal', { opacity: 1 });

    // Fade and slide in navigation
    gsap.from('nav', { 
        y: -30, 
        opacity: 0, 
        duration: 0.8, 
        ease: "power3.out" 
    });

    // Animate the header
    if (document.querySelector('header')) {
        gsap.from('header', { 
            y: 40, 
            opacity: 0, 
            duration: 1, 
            delay: 0.2,
            ease: "expo.out" 
        });
    }

    // Staggered sections entrance
    if (document.querySelectorAll('section').length > 0) {
        gsap.from('section', { 
            y: 30, 
            opacity: 0, 
            duration: 0.8, 
            stagger: 0.15,
            delay: 0.4,
            ease: "power2.out" 
        });
    }

    // Footer appearance
    if (document.querySelector('footer')) {
        gsap.from('footer', { 
            opacity: 0, 
            duration: 1.2, 
            delay: 1,
            ease: "power1.inOut" 
        });
    }

    // Hover effects for nav links
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            gsap.to(link, { scale: 1.05, duration: 0.2, ease: "power1.out" });
        });
        link.addEventListener('mouseleave', () => {
            gsap.to(link, { scale: 1, duration: 0.2, ease: "power1.in" });
        });
    });
});
