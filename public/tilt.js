// Dynamic 3D Card Tilt & Parallax Specular Reflection Effect

(function initTilt() {
  function apply3DTilt(card) {
    if (card.dataset.tiltInitialized) return;
    card.dataset.tiltInitialized = "true";

    // Create specular shine layer if not present
    let shine = card.querySelector('.tilt-shine');
    if (!shine) {
      shine = document.createElement('div');
      shine.className = 'tilt-shine';
      card.appendChild(shine);
    }

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const deltaX = (x - centerX) / centerX;
      const deltaY = (y - centerY) / centerY;

      // Calculate 3D tilt angles (max ~10deg)
      const rotateX = (-deltaY * 8).toFixed(2);
      const rotateY = (deltaX * 8).toFixed(2);

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
      
      // Update specular shine position
      const shineAngle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
      shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
      shine.style.background = `none`;
    });
  }

  function scanAndBind() {
    const selector = '.auth-panel, .search-form, .job-row, .compose-panel, .view-card, [data-tilt]';
    document.querySelectorAll(selector).forEach(apply3DTilt);
  }

  // Scan initially & observe DOM changes for dynamically inserted job rows
  document.addEventListener('DOMContentLoaded', scanAndBind);
  
  const observer = new MutationObserver(() => {
    scanAndBind();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
