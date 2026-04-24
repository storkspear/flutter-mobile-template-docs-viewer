mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Noto Sans KR, Inter, sans-serif',
  flowchart: { useMaxWidth: false, htmlLabels: false },
  sequence:   { useMaxWidth: false },
  gantt:      { useMaxWidth: false },
  themeVariables: {
    edgeLabelBackground: '#ffffff',
  }
});

marked.use({
  breaks: true,
  gfm: true,
  html: true,
  renderer: {
    code({ text, lang }) {
      if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`;
      }
      if (!lang) lang = '';
      const validLang = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : (lang ? hljs.highlightAuto(text).value : text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      const langLabel = lang ? `<div class="code-lang">${lang}</div>` : '';
      return `<div style="position:relative">${langLabel}<pre class="hljs"><code>${highlighted}</code></pre></div>`;
    },
    heading({ text, depth, raw }) {
      const slug = raw
        .replace(/`[^`]*`/g, m => m.slice(1, -1))
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-');
      return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
    }
  }
});

let META = {};

// ── Nav icons (Lucide-style stroke SVGs) ──
const ICON_PATHS = {
  // ── 시작하기 ──
  'README.md':                  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`, // book-open
  'STYLE_GUIDE.md':             `<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>`, // type (문서 스타일)

  // ── Journey (여정) ──
  'journey/README.md':          `<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>`, // compass
  'journey/architecture.md':    `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`, // layers
  'journey/onboarding.md':      `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`, // play-circle
  'journey/build-first-app.md': `<path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>`, // hammer
  'journey/deployment.md':      `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`, // rocket
  'journey/dogfood-pitfalls.md':`<path d="M2.586 17.414A2 2 0 0 1 2 16V8a2 2 0 0 1 .586-1.414l4-4A2 2 0 0 1 8 2h8a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 22 8v8a2 2 0 0 1-.586 1.414l-4 4A2 2 0 0 1 16 22H8a2 2 0 0 1-1.414-.586z"/><path d="M12 8v4"/><path d="M12 16h.01"/>`, // octagon-alert
  'journey/dogfood-faq.md':     `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`, // help-circle

  // ── Philosophy (ADR) ──
  'philosophy/README.md':                        `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`, // lightbulb
  'philosophy/adr-001-template-cherry-pick.md':  `<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>`, // git-merge
  'philosophy/adr-002-layered-modules.md':       `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`, // layers
  'philosophy/adr-003-featurekit-registry.md':   `<path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>`, // package
  'philosophy/adr-004-manual-sync-ci-audit.md':  `<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>`, // workflow
  'philosophy/adr-005-riverpod-mvvm.md':         `<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>`, // filter-pyramid (MVVM 계층)
  'philosophy/adr-006-debug-fallback.md':        `<rect width="16" height="10" x="4" y="8" rx="2"/><path d="M6 8V6a6 6 0 0 1 12 0v2"/><path d="M12 13v3"/>`, // bug
  'philosophy/adr-007-late-binding.md':          `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`, // link
  'philosophy/adr-008-boot-step.md':             `<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>`, // play-circle
  'philosophy/adr-009-backend-contract.md':      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>`, // file-json
  'philosophy/adr-010-queued-interceptor.md':    `<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>`, // refresh-cw
  'philosophy/adr-011-interceptor-chain.md':     `<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>`, // link-2
  'philosophy/adr-012-per-app-user.md':          `<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>`, // user
  'philosophy/adr-013-token-atomic-storage.md':  `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12l2 2 4-4"/>`, // shield-check
  'philosophy/adr-014-cached-repository.md':     `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>`, // database
  'philosophy/adr-015-palette-registry.md':      `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>`, // palette
  'philosophy/adr-016-i18n-from-start.md':       `<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`, // globe
  'philosophy/adr-017-loading-ux.md':            `<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`, // loader
  'philosophy/adr-018-redirect-priority.md':     `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`, // arrow-right
  'philosophy/adr-019-solo-friendly.md':         `<circle cx="12" cy="8" r="4"/><path d="M18 20a6 6 0 0 0-12 0"/>`, // user-round
  'philosophy/adr-020-security-hardening.md':    `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>`, // shield-alert
  'philosophy/adr-021-multi-recipe.md':          `<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/>`, // chef-hat

  // ── Architecture ──
  'architecture/module-dependencies.md':  `<path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"/><path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.44-.85a1 1 0 0 0-.87-.52H13a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1Z"/><path d="M3 5a2 2 0 0 0 2 2h3"/><path d="M3 3v13a2 2 0 0 0 2 2h3"/>`, // folder-tree
  'architecture/featurekit-contract.md':  `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 14l2 2 4-4"/>`, // square-check
  'architecture/boot-sequence.md':        `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`, // clock

  // ── Features (Kit 13개) ──
  'features/README.md':             `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`, // book-open
  'features/backend-api-kit.md':    `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>`, // cloud
  'features/auth-kit.md':           `<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`, // lock
  'features/observability-kit.md':  `<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>`, // radar
  'features/notifications-kit.md':  `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`, // bell
  'features/local-db-kit.md':       `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>`, // database
  'features/update-kit.md':         `<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>`, // refresh-cw
  'features/onboarding-kit.md':     `<line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>`, // user-plus
  'features/nav-shell-kit.md':      `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/><path d="M9 15v6"/><path d="M15 15v6"/>`, // layout-dashboard
  'features/charts-kit.md':         `<rect width="4" height="8" x="4" y="12" rx="1"/><rect width="4" height="14" x="10" y="6" rx="1"/><rect width="4" height="11" x="16" y="9" rx="1"/><line x1="2" x2="22" y1="21" y2="21"/>`, // bar-chart
  'features/ads-kit.md':            `<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>`, // megaphone
  'features/background-kit.md':     `<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>`, // hourglass
  'features/permissions-kit.md':    `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`, // shield-check
  'features/device-info-kit.md':    `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`, // smartphone

  // ── API Contract ──
  'api-contract/README.md':          `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`, // book-open
  'api-contract/response-schema.md': `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12a1 1 0 0 0-1 1v1a2 2 0 0 1-2 2 2 2 0 0 1 2 2v1a1 1 0 0 0 1 1"/><path d="M14 18a1 1 0 0 0 1-1v-1a2 2 0 0 1 2-2 2 2 0 0 1-2-2v-1a1 1 0 0 0-1-1"/>`, // file-json (braces)
  'api-contract/search-request.md':  `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`, // search
  'api-contract/error-codes.md':     `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v2"/><path d="M12 13h.01"/>`, // message-square-warning
  'api-contract/auth-flow.md':       `<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>`, // key-round

  // ── Infra ──
  'infra/android-deployment.md': `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`, // smartphone
  'infra/ios-deployment.md':     `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`, // smartphone
  'infra/security.md':           `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`, // shield
  'infra/ci-cd.md':              `<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>`, // workflow
  'infra/secrets-management.md': `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`, // settings (gear)

  // ── Conventions ──
  'conventions/README.md':         `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`, // book-open
  'conventions/naming.md':         `<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>`, // type
  'conventions/viewmodel-mvvm.md': `<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>`, // layers
  'conventions/error-handling.md': `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`, // triangle-alert
  'conventions/loading-ux.md':     `<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`, // loader
  'conventions/i18n.md':           `<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`, // globe

  // ── Testing ──
  'testing/testing-strategy.md': `<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>`, // flask-conical
  'testing/contract-testing.md': `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/>`, // file-check

  // ── Reference ──
  'reference/scripts.md':                 `<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>`, // terminal
  'reference/recipes.md':                 `<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/>`, // chef-hat
  'reference/glossary.md':                `<path d="M12 7v14"/><path d="M16 12h2"/><path d="M16 8h2"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3z"/><path d="M6 12h2"/><path d="M6 8h2"/>`, // book-a
  'reference/migration-from-template.md': `<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>`, // git-merge
};
const DEFAULT_ICON_PATH = `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/>`;
function navIcon(path) {
  const inner = ICON_PATHS[path] || DEFAULT_ICON_PATH;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// 관련 문서 / 책 목차 섹션을 content에서 분리해 doc-footer로 이동
function extractDocFooter(contentEl) {
  const children = Array.from(contentEl.children);
  const footerPatterns = [/관련\s*문서/, /책\s*목차/];

  let splitIdx = -1;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.tagName === 'H2') {
      const text = el.textContent.replace(/^\d+\.\s*/, '').trim();
      if (footerPatterns.some(p => p.test(text))) {
        // 앞에 <hr>이 있으면 그것도 포함
        splitIdx = (i > 0 && children[i - 1].tagName === 'HR') ? i - 1 : i;
        break;
      }
    }
  }

  if (splitIdx === -1) return null;

  const toMove = children.slice(splitIdx);
  const wrapper = document.createElement('div');
  toMove.forEach(el => {
    contentEl.removeChild(el);
    wrapper.appendChild(el);
  });
  return wrapper.innerHTML;
}

function transformEmoji(html) {
  return html
    .replace(/✅/g, '<span class="si si-check"></span>')
    .replace(/❌/g, '<span class="si si-cross"></span>')
    .replace(/🔴/g, '<span class="si si-dot si-red"></span>')
    .replace(/🟡/g, '<span class="si si-dot si-yellow"></span>')
    .replace(/🟢/g, '<span class="si si-dot si-green"></span>')
    .replace(/⚠️/g, '<span class="si si-warn"></span>')
    .replace(/🚨/g, '<span class="si si-alert"></span>');
}

// .md 상대 경로 링크를 SPA 내부 라우팅으로 인터셉트
function interceptDocLinks(el, currentDocPath) {
  const baseDir = currentDocPath.includes('/')
    ? currentDocPath.slice(0, currentDocPath.lastIndexOf('/') + 1)
    : '';

  el.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
    // .md 뒤에 #anchor 가 붙어있어도 처리 (예: './error-handling.md#screen-에서-i18n-변환')
    const mdIdx = href.indexOf('.md');
    if (mdIdx === -1) return;

    const mdPath = href.slice(0, mdIdx + 3);
    const anchor = href.slice(mdIdx + 3);           // '#anchor' 또는 ''
    const targetId = anchor ? anchor.slice(1) : null;

    const raw = baseDir + mdPath;
    const parts = raw.split('/');
    const resolved = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else if (p && p !== '.') resolved.push(p);
    }
    const docPath = resolved.join('/');

    a.setAttribute('href', '#' + docPath + anchor);
    a.addEventListener('click', e => {
      e.preventDefault();
      const p = loadDoc(docPath);
      // 로드 완료 후 anchor 로 스크롤
      if (targetId && p && typeof p.then === 'function') {
        p.then(() => {
          const target = document.getElementById(targetId);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (targetId) {
        setTimeout(() => {
          const target = document.getElementById(targetId);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    });
  });
}

function isMobile() { return window.innerWidth <= 768; }

let _typewriterTimer = null;
function typewriter(el, text, speed = 32) {
  if (_typewriterTimer) clearTimeout(_typewriterTimer);
  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent += text[i++];
      _typewriterTimer = setTimeout(tick, speed);
    }
  }
  tick();
}

function scrollActiveNavIntoView() {
  const activeItem = document.querySelector('.nav-item.active');
  const sidebar = document.querySelector('.sidebar');
  if (!activeItem || !sidebar) return;

  const itemTop = activeItem.offsetTop;
  const itemBottom = itemTop + activeItem.offsetHeight;
  const viewTop = sidebar.scrollTop;
  const viewBottom = viewTop + sidebar.clientHeight;
  const margin = 40;

  if (itemTop >= viewTop + margin && itemBottom <= viewBottom - margin) return;

  sidebar.scrollTo({
    top: itemTop - sidebar.clientHeight / 2 + activeItem.offsetHeight / 2,
    behavior: 'smooth',
  });
}

async function loadDoc(docPath) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.doc === docPath);
  });
  scrollActiveNavIntoView();
  if (isMobile()) closeMobileSidebar();

  const meta = META[docPath] || { title: docPath.split('/').pop().replace('.md', ''), desc: '' };
  typewriter(document.getElementById('post-title'), meta.title, 32);
  document.getElementById('post-desc').textContent = meta.desc;
  document.getElementById('content').innerHTML =
    '<p style="color:#9ca3af;text-align:center;padding:60px 0">로딩 중...</p>';

  const docFooterEl = document.getElementById('doc-footer');
  docFooterEl.style.display = 'none';
  docFooterEl.innerHTML = '';

  try {
    const res = await fetch('docs/' + docPath);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let md = await res.text();
    md = md.replace(/```\n\[개발자 맥북\][\s\S]*?```/g, '\n%%LOCAL_DEV_DIAGRAM%%\n');
    md = md.replace(/```\n\[인터넷 사용자\][\s\S]*?```/g, '\n%%PROD_DIAGRAM%%\n');
    let html = transformEmoji(marked.parse(md));
    html = html.replace(/<p>%%LOCAL_DEV_DIAGRAM%%<\/p>/g, DIAGRAMS['LOCAL_DEV']);
    html = html.replace(/<p>%%PROD_DIAGRAM%%<\/p>/g, DIAGRAMS['PROD']);

    const contentEl = document.getElementById('content');
    contentEl.innerHTML = html;

    document.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));

    let mermaidId = 0;
    for (const el of document.querySelectorAll('#content .mermaid')) {
      const code = el.textContent.trim();
      const id = `mermaid-${mermaidId++}`;
      try {
        const { svg } = await mermaid.render(id, code);
        el.innerHTML = svg;
        const svgEl = el.querySelector('svg');
        if (svgEl) {
          svgEl.style.maxWidth = '100%';
          svgEl.setAttribute('overflow', 'visible');
          const vb = svgEl.getAttribute('viewBox');
          if (vb) {
            const [x, y, w, h] = vb.trim().split(/[\s,]+/).map(Number);
            svgEl.setAttribute('viewBox', `${x} ${y} ${w + 40} ${h + 10}`);
          }
        }
      } catch(e) {
        el.innerHTML = `<pre style="color:red">${e.message}</pre>`;
      }
    }

    // footer 섹션 분리
    const footerHtml = extractDocFooter(contentEl);
    if (footerHtml) {
      docFooterEl.innerHTML = footerHtml;
      docFooterEl.style.display = 'block';
      interceptDocLinks(docFooterEl, docPath);
    }

    // 모바일 테이블 스크롤 래핑
    if (isMobile()) {
      contentEl.querySelectorAll('table').forEach(table => {
        if (table.closest('.table-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      });
    }

    interceptDocLinks(contentEl, docPath);

    window.scrollTo(0, 0);
    history.pushState({ doc: docPath }, '', '#' + docPath);
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<p style="color:#ef4444;padding:20px">오류: ${e.message}</p>`;
  }
}

function buildSidebar(manifest) {
  const sidebar = document.querySelector('.sidebar');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'sidebar-close-btn';
  closeBtn.id = 'sidebar-close-btn';
  closeBtn.title = '사이드바 접기';
  closeBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m15 18-6-6 6-6"/>
    </svg>`;
  sidebar.appendChild(closeBtn);

  const brand = document.createElement('div');
  brand.className = 'sidebar-brand';
  brand.innerHTML = `
    <div class="sidebar-brand-mark"></div>
    <div class="sidebar-brand-text">
      <div class="name">${manifest.brand.name}</div>
      <div class="sub">${manifest.brand.sub}</div>
    </div>`;
  sidebar.appendChild(brand);

  manifest.groups.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'nav-group';
    groupEl.textContent = group.name;
    sidebar.appendChild(groupEl);

    group.files.forEach(file => {
      META[file.path] = { title: file.title, desc: file.desc };
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.dataset.doc = file.path;
      const descHtml = file.desc ? `<span class="nav-item-desc">${file.desc}</span>` : '';
      a.innerHTML = `<span class="nav-icon">${navIcon(file.path)}</span><span class="nav-item-inner"><span class="nav-item-title">${file.title}</span>${descHtml}</span>`;
      sidebar.appendChild(a);

      if (file.children) {
        file.children.forEach(child => {
          META[child.path] = { title: child.title, desc: child.desc };
          const ca = document.createElement('a');
          ca.className = 'nav-item nav-item-child';
          ca.dataset.doc = child.path;
          const childDescHtml = child.desc ? `<span class="nav-item-desc">${child.desc}</span>` : '';
          ca.innerHTML = `<span class="nav-icon">${navIcon(child.path)}</span><span class="nav-item-inner"><span class="nav-item-title">${child.title}</span>${childDescHtml}</span>`;
          sidebar.appendChild(ca);
        });
      }
    });
  });

  sidebar.addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (item && item.dataset.doc) loadDoc(item.dataset.doc);
  });
}

async function init() {
  const res = await fetch('docs/manifest.json');
  const manifest = await res.json();
  buildSidebar(manifest);

  const hash = location.hash.slice(1);
  const firstDoc = manifest.groups[0].files[0].path;
  loadDoc(hash || firstDoc);
}

window.addEventListener('popstate', e => {
  if (e.state && e.state.doc) loadDoc(e.state.doc);
});

const backdrop = document.createElement('div');
backdrop.id = 'sidebar-backdrop';
document.body.appendChild(backdrop);
backdrop.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
  document.body.classList.remove('sidebar-open');
}

function toggleSidebar() {
  if (isMobile()) {
    document.body.classList.toggle('sidebar-open');
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
}

document.getElementById('sidebar-open-btn').addEventListener('click', toggleSidebar);
document.addEventListener('click', e => {
  if (e.target.closest('#sidebar-close-btn')) toggleSidebar();
});

if (isMobile()) {
  document.body.classList.add('sidebar-collapsed');
}

init();
