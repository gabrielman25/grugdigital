/* Grug · how to reach Grug Digital (assets/contact.js)

   The one place for our contact details. The dashboards (Daypart business/, Bubble Tea business/tea/, Café
   business/cafe/) load this file and put a "Contact us" button in their top bar, so help is one tap away on every screen.
   Change a detail here and every dashboard has it. Leave one empty ('') and its row is left out.

     <button data-grug-contact>…</button>   any element: a tap opens the sheet (this file listens for it)
     GrugContact.button(cls)               the button's HTML (icon + "Contact us"; the label hides on narrow screens)
     GrugContact.open()                    opens the sheet from code
*/
window.GRUG_CONTACT = {
  discord: 'https://discord.gg/3ENePvNGJy',   // Grug Digital's server (Nov 2026; the sidebar's Discord, the dashboards' Contact us, for/managers/)
  instagram: '',                              // the handle without the @, e.g. 'grugdigital'
  text: '954-459-6301',                       // texts only, please, no calls (support.html, privacy.html, terms.html)
  email: ''                                   // e.g. 'hello@grugdigital.com'
};
(function () {
  'use strict';
  if (window.GrugContact) return;
  const C = () => window.GRUG_CONTACT || {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>'),
    discord: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>'),
    instagram: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".9" fill="currentColor"/>'),
    text: svg('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'),
    email: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    go: svg('<path d="M9 5l7 7-7 7"/>')
  };
  const digits = t => String(t).replace(/[^\d+]/g, '');
  function rows() {
    const c = C(), out = [];
    if (c.discord) out.push(['discord', 'Chat with us on Discord', 'Questions, ideas, problems: real people answer', c.discord, '#5865F2']);
    if (c.instagram) out.push(['instagram', 'Instagram', '@' + String(c.instagram).replace(/^@/, ''), 'https://instagram.com/' + encodeURIComponent(String(c.instagram).replace(/^@/, '')), '#E1306C']);
    if (c.text) out.push(['text', 'Text us', c.text + ' · texts only, please', 'sms:' + digits(c.text), '#2FAE5A']);
    if (c.email) out.push(['email', 'Email us', c.email, 'mailto:' + c.email, '#FF9F5A']);
    return out;
  }
  function css() {
    if (document.getElementById('grug-contact-css')) return;
    const s = document.createElement('style'); s.id = 'grug-contact-css';
    s.textContent = `
.gc-btn{display:inline-flex;align-items:center;gap:.4rem;min-height:2.6rem;padding:0 .95rem 0 .75rem;border:0;border-radius:999px;background:#fff;color:#1E1B16;
  font:600 .92rem/1 Fredoka,system-ui,sans-serif;cursor:pointer;box-shadow:0 .25rem .9rem rgba(30,27,22,.07),inset 0 0 0 1px rgba(30,27,22,.1);white-space:nowrap;flex:none}
.gc-btn svg{width:1.25rem;height:1.25rem;flex:none;color:#5865F2}.gc-btn:active{transform:scale(.95)}
.gc-btn:focus-visible{outline:3px solid #1E1B16;outline-offset:2px}
@media(max-width:600px){.gc-btn{padding:0;width:2.6rem;justify-content:center}.gc-btn span{display:none}}
.gc-scrim{position:fixed;inset:0;z-index:2147482000;background:rgba(30,27,22,.45);display:flex;align-items:flex-end;justify-content:center;padding:1rem;animation:gcf .15s both}
@media(min-width:640px){.gc-scrim{align-items:center}}
@media(max-width:639px){.gc-scrim{padding:0}.gc-card{border-radius:1.2rem 1.2rem 0 0!important;padding-bottom:calc(1.1rem + env(safe-area-inset-bottom,0px))!important}}
.gc-card{width:min(100%,27rem);max-height:92vh;overflow:auto;background:#fff;color:#1E1B16;border-radius:1.2rem;padding:1.2rem 1.2rem 1.1rem;font:400 1rem/1.4 Fredoka,system-ui,sans-serif;
  box-shadow:0 20px 60px rgba(0,0,0,.3);animation:gcr .22s cubic-bezier(.2,.8,.2,1) both}
.gc-hd{display:flex;align-items:center;gap:.6rem;margin-bottom:.2rem}.gc-hd h2{margin:0;flex:1;font:700 1.35rem/1.2 Fredoka,system-ui,sans-serif}
.gc-x{width:2.6rem;height:2.6rem;border:0;border-radius:50%;background:#F1EEE7;display:grid;place-items:center;cursor:pointer;color:#1E1B16}.gc-x svg{width:1.2rem;height:1.2rem}
.gc-card p{margin:0 0 .9rem;color:#4A453D}
.gc-row{display:flex;align-items:center;gap:.85rem;min-height:4rem;padding:.6rem .8rem;margin-top:.5rem;border-radius:.9rem;background:#F6F4EF;color:#1E1B16;text-decoration:none;transition:transform .1s,background .12s}
.gc-row:hover{background:#EFEBE3}.gc-row:active{transform:scale(.98)}.gc-row:focus-visible{outline:3px solid #1E1B16;outline-offset:2px}
.gc-row .ic{width:2.7rem;height:2.7rem;border-radius:.75rem;display:grid;place-items:center;flex:none;color:#fff}.gc-row .ic svg{width:1.5rem;height:1.5rem}
.gc-row b{display:block;font-weight:700;font-size:1.05rem}.gc-row small{display:block;color:#6B655B;font-size:.9rem;word-break:break-word}
.gc-row .tx{flex:1;min-width:0}.gc-row .go{width:1.2rem;height:1.2rem;color:#8F887C;flex:none}.gc-row .go svg{width:100%;height:100%}
@keyframes gcf{from{opacity:0}}@keyframes gcr{from{opacity:0;transform:translateY(.6rem)}}
@media(prefers-reduced-motion:reduce){.gc-scrim,.gc-card{animation:none}}`;
    document.head.appendChild(s);
  }
  function open() {
    css();
    const list = rows(); if (!list.length) return;
    const scrim = document.createElement('div'); scrim.className = 'gc-scrim';
    scrim.innerHTML = '<div class="gc-card" role="dialog" aria-modal="true" aria-label="Contact Grug Digital"><div class="gc-hd"><h2>Need help? Ask us.</h2><button type="button" class="gc-x" aria-label="Close">' + IC.x + '</button></div>' +
      '<p>We made this dashboard and we’re happy to help: setting it up, a question, or something that isn’t working.</p>' +
      list.map(([k, title, sub, href, col]) => '<a class="gc-row" href="' + esc(href) + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '><span class="ic" style="background:' + col + '">' + IC[k] + '</span><span class="tx"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span><span class="go">' + IC.go + '</span></a>').join('') + '</div>';
    const close = () => { scrim.remove(); document.removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('.gc-x')) close(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(scrim);
    scrim.querySelector('.gc-x').focus();
  }
  const button = cls => (css(), '<button type="button" class="gc-btn' + (cls ? ' ' + cls : '') + '" data-grug-contact title="Contact us" aria-label="Contact us">' + IC.chat + '<span>Contact us</span></button>');
  document.addEventListener('click', e => { const b = e.target.closest('[data-grug-contact]'); if (b) { e.preventDefault(); open(); } });
  if (document.head) css(); else document.addEventListener('DOMContentLoaded', css);
  window.GrugContact = { open, button, rows };
})();
