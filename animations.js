// Enhanced Animation System
document.addEventListener('DOMContentLoaded', () => {
    // Initialize AOS with enhanced settings
    AOS.init({
        duration: 1200,
        once: false,
        mirror: true,
        offset: 120,
        easing: 'ease-out-cubic',
        anchorPlacement: 'top-bottom'
    });

    // Initialize Vanilla Tilt for 3D hover effects
    VanillaTilt.init(document.querySelectorAll('.feature-card'), {
        max: 10,
        speed: 400,
        glare: true,
        'max-glare': 0.3,
        scale: 1.05
    });

    // GSAP Animations
    gsap.registerPlugin(ScrollTrigger);

    // Hero Section Animation
    gsap.from('.hero-content', {
        duration: 1.5,
        y: 100,
        opacity: 0,
        ease: 'power4.out'
    });

    // Feature Cards Stagger Animation
    gsap.from('.feature-card', {
        scrollTrigger: {
            trigger: '.features',
            start: 'top center',
            toggleActions: 'play none none reverse'
        },
        duration: 0.8,
        y: 50,
        opacity: 0,
        stagger: 0.2,
        ease: 'back.out(1.7)'
    });

    // Stats Counter Animation
    const statsSection = document.querySelector('.stats');
    const statNumbers = document.querySelectorAll('.stat-number');
    
    let animated = false;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                statNumbers.forEach(stat => {
                    const target = parseInt(stat.getAttribute('data-target'));
                    animateValue(stat, 0, target, 2000);
                });
            }
        });
    });
    
    observer.observe(statsSection);

    // Smooth Counter Animation
    function animateValue(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const animate = () => {
            current += increment;
            if (current >= end) {
                element.textContent = end.toLocaleString();
            } else {
                element.textContent = Math.floor(current).toLocaleString();
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    // Enhanced Particle System
    function createParticles() {
        const particles = document.getElementById('particles');
        const particleCount = 50;
        const colors = ['#5865F2', '#57F287', '#EB459E'];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Random properties
            const size = Math.random() * 5 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.background = color;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            
            // Custom animation
            particle.style.animationDelay = `${Math.random() * 5}s`;
            particle.style.animationDuration = `${Math.random() * 10 + 5}s`;
            
            particles.appendChild(particle);
        }
    }

    // Scroll Progress Indicator
    const progressBar = document.querySelector('.scroll-progress');
    
    window.addEventListener('scroll', () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.scrollY / documentHeight;
        
        progressBar.style.transform = `scaleX(${scrolled})`;
    });

    // Smooth Scroll for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Initialize Particle System
    createParticles();
});