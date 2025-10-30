/**
 * @Author: Your name
 * @Date:   2025-10-26 19:46:35
 * @Last Modified by:   Your name
 * @Last Modified time: 2025-10-26 20:14:47
 */
// script.js - Xử lý chính cho trang web LeiLaBOT

document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo AOS
    AOS.init({
        duration: 1000,
        once: true,
        offset: 100
    });

    // Loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingProgress = document.getElementById('loadingProgress');
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            loadingProgress.style.width = '100%';
            
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                // Tải dữ liệu bot sau khi loading hoàn tất
                initializeBotFeatures();
            }, 500);
        } else {
            loadingProgress.style.width = progress + '%';
        }
    }, 200);
    
    // Khởi tạo các tính năng bot
    function initializeBotFeatures() {
        updateStats();
        createParticles();
        initNavigation();
        initScrollEffects();
        
        // Hiệu ứng cho feature cards
        initFeatureCards();
        
        // Hiệu ứng cho command items
        initCommandItems();
    }
    
    // Cập nhật thống kê với hiệu ứng số đếm
    function updateStats() {
        const stats = {
            servers: 150,
            users: 12500,
            commands: 60
        };
        
        animateCounter(document.getElementById('serverCount'), 0, stats.servers, 2000);
        animateCounter(document.getElementById('userCount'), 0, stats.users, 2500);
        animateCounter(document.getElementById('commandCount'), 0, stats.commands, 1500);
    }
    
    // Hiệu ứng số đếm
    function animateCounter(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerHTML = Math.floor(progress * (end - start) + start) + "+";
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
    
    // Khởi tạo navigation
    function initNavigation() {
        const navbar = document.getElementById('navbar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const navLinks = document.getElementById('navLinks');
        
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
        
        // Mobile menu
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.innerHTML = navLinks.classList.contains('active') ? 
                '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
        
        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            });
        });
    }
    
    // Khởi tạo scroll effects
    function initScrollEffects() {
        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
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
        
        // Scroll to top button
        const scrollTop = document.getElementById('scrollTop');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTop.classList.add('active');
            } else {
                scrollTop.classList.remove('active');
            }
        });
        
        scrollTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
    // Hiệu ứng cho feature cards
    function initFeatureCards() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-15px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)';
            });
        });
        
        // Khởi tạo Vanilla Tilt cho feature cards
        if (typeof VanillaTilt !== 'undefined') {
            VanillaTilt.init(document.querySelectorAll('.feature-card'), {
                max: 8,
                speed: 400,
                glare: true,
                'max-glare': 0.2,
                scale: 1.02
            });
        }
    }
    
    // Hiệu ứng cho command items
    function initCommandItems() {
        const commandItems = document.querySelectorAll('.command-item');
        
        commandItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'translateX(10px) translateY(-5px)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.transform = 'translateX(0) translateY(0)';
            });
        });
    }
    
    // Tạo hiệu ứng particles
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 30;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const size = Math.random() * 5 + 2;
            const colors = ['#5865F2', '#57F287', '#EB459E', '#FEE75C'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 50%;
                position: absolute;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: 0;
                animation: particleFloat ${Math.random() * 10 + 5}s infinite;
                animation-delay: ${Math.random() * 5}s;
            `;
            
            particlesContainer.appendChild(particle);
        }
        
        // Add particle animation styles
        if (!document.getElementById('particle-styles')) {
            const style = document.createElement('style');
            style.id = 'particle-styles';
            style.textContent = `
                @keyframes particleFloat {
                    0% {
                        transform: translateY(0) translateX(0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-100px) translateX(${Math.random() > 0.5 ? '-' : ''}${Math.random() * 50}px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Thêm hiệu ứng cho buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
        
        btn.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px)';
        });
        
        btn.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-3px)';
        });
    });
    
    // Hiệu ứng typewriter cho tagline
    function typeWriterEffect() {
        const tagline = document.querySelector('.tagline');
        const text = tagline.textContent;
        tagline.textContent = '';
        let i = 0;
        
        function type() {
            if (i < text.length) {
                tagline.textContent += text.charAt(i);
                i++;
                setTimeout(type, 50);
            }
        }
        
        // Bắt đầu hiệu ứng sau 1 giây
        setTimeout(type, 1000);
    }
    
    // Khởi chạy hiệu ứng typewriter
    typeWriterEffect();
    
    // Thêm hiệu ứng parallax cho header
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallax = document.querySelector('header');
        if (parallax) {
            parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
    });
    
    // Hiệu ứng cho stats khi scroll vào view
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);
    
    // Quan sát các stat items
    document.querySelectorAll('.stat-item').forEach(item => {
        observer.observe(item);
    });
});

// Thêm styles cho các hiệu ứng động
const dynamicStyles = `
    .stat-item.animated .stat-number {
        animation: countUp 1s ease-out forwards;
    }
    
    @keyframes countUp {
        from {
            transform: translateY(30px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    .feature-card {
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    .command-item {
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    .btn {
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    header {
        transition: transform 0.1s ease-out;
    }
`;

// Thêm styles động vào document
const styleSheet = document.createElement('style');
styleSheet.textContent = dynamicStyles;
document.head.appendChild(styleSheet);