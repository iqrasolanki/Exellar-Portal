/**
 * Exellar.LLP Document Upload Portal - Brand-Aligned Scripts & Share Helpers
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // --- Dynamic Environment & QR Link Helper ---
  const currentOrigin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://exellar-portal.vercel.app';
  const qrTarget = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')
    ? 'https://exellar-portal.vercel.app'
    : currentOrigin;

  const modalQrImg = document.getElementById('modal-qr-img');
  const modalShareLink = document.getElementById('modal-share-link');
  const modalOpenBtn = document.getElementById('modal-open-btn');

  if (modalQrImg) {
    modalQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrTarget)}`;
  }
  if (modalShareLink) {
    modalShareLink.href = qrTarget;
    modalShareLink.textContent = qrTarget;
  }
  if (modalOpenBtn) {
    modalOpenBtn.href = qrTarget;
  }

  // --- Mobile Navigation Toggle ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  window.openMobileMenu = function() {
    if (mobileMenu) {
      mobileMenu.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeMobileMenu = function() {
    if (mobileMenu) {
      mobileMenu.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileMenu);
  if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  // --- Active Nav Link Underline Handling ---
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function () {
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // --- Share & QR Modal Helpers ---
  const shareModal = document.getElementById('share-modal');
  
  window.toggleShareModal = function() {
    if (!shareModal) return;
    if (shareModal.classList.contains('hidden')) {
      shareModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      shareModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target === shareModal) toggleShareModal();
    });
  }

  window.copyModalLink = function() {
    const linkText = modalShareLink ? modalShareLink.href : qrTarget;
    copyToClipboard(linkText);
  };

  window.copyToClipboard = function(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast()).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast();
    } catch (err) {
      console.error('Copy failed', err);
    }
    document.body.removeChild(textArea);
  }

  function showToast() {
    const toast = document.getElementById('share-toast');
    if (toast) {
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2500);
    }
  }

  // Escape key closes modals and mobile menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (shareModal && !shareModal.classList.contains('hidden')) toggleShareModal();
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) closeMobileMenu();
    }
  });
});

