import { Layout } from '../components/layout/Layout'
import { useLanguage } from '../contexts/LanguageContext'

export default function AiSmmAgent() {
  const { t } = useLanguage()
  return (
    <Layout>
      {/* Inject scoped styles */}
      <style>{`
        .aismmpage {
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 50%, #fdf2f8 100%);
          color: #0f172a;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
          padding: 32px 24px 64px;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Buttons ── */
        .ap-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 24px; border-radius: 999px; text-decoration: none;
          font-weight: 600; font-size: 15px; border: 1px solid transparent;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .ap-btn-primary {
          background: #2563eb; color: white;
          box-shadow: 0 12px 30px rgba(37,99,235,0.25);
        }
        .ap-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(37,99,235,0.35); }
        .ap-btn-secondary {
          background: rgba(255,255,255,0.7); color: #0f172a;
          border: 1px solid rgba(148,163,184,0.35);
        }
        .ap-btn-secondary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(15,23,42,0.1); }
        .ap-btn-telegram {
          background: #0088cc; color: white;
          box-shadow: 0 12px 30px rgba(0,136,204,0.3);
          font-size: 16px; padding: 16px 32px;
        }
        .ap-btn-telegram:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(0,136,204,0.4); background: #0077b5; }
        .ap-btn-large { font-size: 17px; padding: 18px 36px; }

        /* ── Hero ── */
        .ap-hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          padding: 40px 0 64px;
        }
        .ap-hero-content { display: flex; flex-direction: column; gap: 24px; }
        .ap-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, rgba(0,136,204,0.1), rgba(124,58,237,0.1));
          border: 1px solid rgba(0,136,204,0.2);
          color: #0088cc;
          font-weight: 600; font-size: 13px;
          padding: 6px 16px; border-radius: 999px;
          width: fit-content;
        }
        .ap-badge-dot {
          display: inline-block; width: 8px; height: 8px;
          background: #0088cc; border-radius: 50%;
          animation: ap-pulse 2s infinite;
        }
        @keyframes ap-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .ap-hero h1 {
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
          background: linear-gradient(135deg, #0f172a 0%, #2563eb 60%, #7c3aed 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin: 0;
        }
        .ap-hero-sub { font-size: 18px; line-height: 1.6; color: #475569; max-width: 520px; margin: 0; }
        .ap-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .ap-hero-stats {
          display: flex; gap: 24px; align-items: center;
          padding: 20px 0; margin-top: 8px;
        }
        .ap-stat-item { display: flex; flex-direction: column; align-items: center; }
        .ap-stat-number { font-size: 28px; font-weight: 800; color: #2563eb; }
        .ap-stat-label { font-size: 13px; color: #475569; font-weight: 500; }
        .ap-stat-divider { width: 1px; height: 36px; background: rgba(148,163,184,0.35); }

        /* ── Phone Mockup ── */
        .ap-hero-visual { display: flex; justify-content: center; }
        .ap-phone {
          width: 300px; background: #1a1a2e; border-radius: 36px; padding: 12px;
          box-shadow: 0 40px 80px rgba(15,23,42,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset;
          position: relative;
        }
        .ap-phone-notch {
          width: 120px; height: 28px; background: #1a1a2e;
          border-radius: 0 0 16px 16px; margin: 0 auto; position: relative; z-index: 2;
        }
        .ap-phone-screen { background: #ffffff; border-radius: 24px; overflow: hidden; margin-top: -14px; }
        .ap-chat-header {
          display: flex; align-items: center; gap: 10px; padding: 14px 16px;
          background: linear-gradient(135deg, #0088cc, #0077b5); color: white;
        }
        .ap-chat-avatar {
          width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px;
        }
        .ap-chat-name { font-weight: 600; font-size: 14px; }
        .ap-chat-status { font-size: 11px; opacity: 0.8; }
        .ap-chat-messages { padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 240px; }
        .ap-chat-msg {
          padding: 10px 14px; border-radius: 16px; font-size: 12px; line-height: 1.5;
          max-width: 85%; animation: ap-fadeInUp 0.5s ease forwards; opacity: 0;
        }
        .ap-chat-msg:nth-child(1) { animation-delay: 0.2s; }
        .ap-chat-msg:nth-child(2) { animation-delay: 0.6s; }
        .ap-chat-msg:nth-child(3) { animation-delay: 1s; }
        .ap-chat-msg:nth-child(4) { animation-delay: 1.4s; }
        .ap-chat-msg:nth-child(5) { animation-delay: 1.8s; }
        @keyframes ap-fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ap-chat-msg.bot { background: #f0f2f5; color: #0f172a; align-self: flex-start; border-bottom-left-radius: 4px; }
        .ap-chat-msg.user { background: #0088cc; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
        .ap-chat-input { padding: 12px 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }

        /* ── Platforms Bar ── */
        .ap-platforms { text-align: center; padding: 32px 0 48px; }
        .ap-platforms-label { font-size: 14px; color: #475569; font-weight: 500; margin-bottom: 16px; }
        .ap-platforms-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .ap-platform-pill {
          background: rgba(255,255,255,0.8); border: 1px solid rgba(148,163,184,0.35);
          border-radius: 999px; padding: 10px 20px; font-size: 14px; font-weight: 600;
          color: #0f172a; transition: transform 0.2s, box-shadow 0.2s;
        }
        .ap-platform-pill:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,23,42,0.08); }

        /* ── Section Heading ── */
        .ap-section-heading { text-align: center; margin-bottom: 48px; }
        .ap-section-heading h2 {
          font-size: clamp(28px, 3vw, 42px); font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: 12px; margin-top: 0;
        }
        .ap-section-heading p { font-size: 17px; color: #475569; max-width: 560px; margin: 0 auto; }

        /* ── Features Grid ── */
        .ap-features { padding: 48px 0; }
        .ap-features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .ap-feature-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(219,234,254,0.4));
          border: 1px solid rgba(148,163,184,0.35); border-radius: 18px;
          padding: 28px 24px; display: flex; flex-direction: column; gap: 12px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          position: relative; overflow: hidden;
        }
        .ap-feature-card::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #2563eb, #7c3aed); opacity: 0; transition: opacity 0.25s;
        }
        .ap-feature-card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(15,23,42,0.12); }
        .ap-feature-card:hover::before { opacity: 1; }
        .ap-feature-highlight {
          grid-column: span 2;
          background: linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06));
          border-color: rgba(37,99,235,0.2);
        }
        .ap-feature-icon { font-size: 32px; }
        .ap-feature-card h3 { font-size: 17px; font-weight: 700; margin: 0; }
        .ap-feature-card p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0; }
        .ap-feature-tag {
          display: inline-flex; width: fit-content;
          background: rgba(37,99,235,0.08); color: #2563eb;
          font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px;
          margin-top: auto;
        }

        /* ── Steps ── */
        .ap-steps { padding: 48px 0; }
        .ap-steps-grid { display: flex; align-items: center; justify-content: center; gap: 0; }
        .ap-step-card {
          background: rgba(255,255,255,0.72); border: 1px solid rgba(148,163,184,0.35);
          border-radius: 18px; padding: 32px 28px; text-align: center;
          flex: 1; max-width: 320px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .ap-step-card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(15,23,42,0.12); }
        .ap-step-number {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #2563eb, #7c3aed); color: white;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 800;
        }
        .ap-step-card h3 { font-size: 18px; font-weight: 700; margin: 0; }
        .ap-step-card p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0; }
        .ap-step-connector {
          width: 48px; height: 2px;
          background: linear-gradient(90deg, #2563eb, #7c3aed); flex-shrink: 0;
        }

        /* ── Reports ── */
        .ap-reports {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; align-items: center; padding: 64px 0;
        }
        .ap-reports-content { display: flex; flex-direction: column; gap: 20px; }
        .ap-reports-content h2 { font-size: clamp(28px, 3vw, 38px); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        .ap-reports-content p { font-size: 16px; color: #475569; line-height: 1.7; margin: 0; }
        .ap-reports-list { list-style: none; display: flex; flex-direction: column; gap: 10px; padding: 0; margin: 0; }
        .ap-reports-list li {
          padding: 10px 16px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(219,234,254,0.5));
          border: 1px solid rgba(148,163,184,0.35); border-radius: 12px;
          font-size: 14px; font-weight: 500;
          display: flex; align-items: center; gap: 10px;
        }
        .ap-reports-list li::before {
          content: "✓"; width: 22px; height: 22px;
          background: rgba(34,197,94,0.12); color: #22c55e; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 12px; flex-shrink: 0;
        }
        .ap-reports-visual { display: flex; justify-content: center; }
        .ap-report-mockup {
          width: 320px; background: white; border-radius: 18px;
          border: 1px solid rgba(148,163,184,0.35);
          box-shadow: 0 24px 60px rgba(15,23,42,0.12); overflow: hidden;
        }
        .ap-report-header {
          background: linear-gradient(135deg, #2563eb, #7c3aed); color: white;
          padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;
        }
        .ap-report-logo { font-weight: 800; font-size: 16px; }
        .ap-report-title-text { font-size: 13px; opacity: 0.9; }
        .ap-report-chart { display: flex; align-items: flex-end; gap: 12px; padding: 24px; height: 140px; }
        .ap-chart-bar {
          flex: 1; background: linear-gradient(180deg, rgba(37,99,235,0.3), rgba(37,99,235,0.08));
          border-radius: 6px 6px 0 0; transition: height 0.6s ease;
        }
        .ap-chart-bar.highlight { background: linear-gradient(180deg, #2563eb, rgba(37,99,235,0.4)); }
        .ap-report-metrics {
          display: flex; justify-content: space-around;
          padding: 16px 24px 20px; border-top: 1px solid #f1f5f9;
        }
        .ap-report-metric { text-align: center; }
        .ap-metric-value { display: block; font-size: 18px; font-weight: 800; color: #2563eb; }
        .ap-metric-label { font-size: 11px; color: #475569; font-weight: 500; }

        /* ── Pricing ── */
        .ap-pricing { padding: 48px 0; }
        .ap-pricing-table-wrap {
          max-width: 600px; margin: 0 auto 32px;
          background: rgba(255,255,255,0.72); border: 1px solid rgba(148,163,184,0.35);
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 8px 24px rgba(15,23,42,0.06);
        }
        .ap-pricing-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .ap-pricing-table thead { background: linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06)); }
        .ap-pricing-table th {
          padding: 14px 20px; text-align: left; font-weight: 700; font-size: 13px;
          color: #475569; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .ap-pricing-table td { padding: 12px 20px; border-top: 1px solid #f1f5f9; }
        .ap-pricing-table td:last-child { font-weight: 700; color: #2563eb; text-align: center; }
        .ap-pricing-table tbody tr:hover { background: rgba(37,99,235,0.02); }
        .ap-credit-packs { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
        .ap-pack-card {
          background: rgba(255,255,255,0.72); border: 1px solid rgba(148,163,184,0.35);
          border-radius: 18px; padding: 28px 32px; text-align: center; min-width: 160px;
          transition: transform 0.25s, box-shadow 0.25s; position: relative;
        }
        .ap-pack-card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(15,23,42,0.12); }
        .ap-pack-popular { border-color: rgba(37,99,235,0.4); box-shadow: 0 12px 30px rgba(37,99,235,0.15); }
        .ap-pack-badge {
          position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          background: #2563eb; color: white; font-size: 11px; font-weight: 700;
          padding: 3px 14px; border-radius: 999px;
        }
        .ap-pack-credits { font-size: 36px; font-weight: 800; color: #0f172a; }
        .ap-pack-label { font-size: 13px; color: #475569; font-weight: 500; margin-bottom: 8px; }
        .ap-pack-price { font-size: 24px; font-weight: 700; color: #2563eb; }

        /* ── Referral ── */
        .ap-referral { padding: 48px 0; }
        .ap-referral-card {
          background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(37,99,235,0.08));
          border: 1px solid rgba(34,197,94,0.2); border-radius: 28px;
          padding: 48px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .ap-referral-icon { font-size: 48px; }
        .ap-referral-card h2 { font-size: clamp(24px, 3vw, 34px); font-weight: 800; margin: 0; }
        .ap-referral-card p { font-size: 16px; color: #475569; max-width: 500px; line-height: 1.6; margin: 0; }

        /* ── Final CTA ── */
        .ap-final-cta {
          background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.12));
          border: 1px solid rgba(99,102,241,0.2); border-radius: 28px;
          padding: 56px 40px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
          margin-top: 16px;
        }
        .ap-final-cta h2 { font-size: clamp(28px, 3vw, 42px); font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        .ap-final-cta p { font-size: 17px; color: #475569; margin: 0; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .ap-hero { grid-template-columns: 1fr; gap: 32px; text-align: center; }
          .ap-hero-content { align-items: center; }
          .ap-hero-sub { max-width: 100%; }
          .ap-hero-actions { justify-content: center; }
          .ap-hero-stats { justify-content: center; }
          .ap-features-grid { grid-template-columns: 1fr 1fr; }
          .ap-feature-highlight { grid-column: span 2; }
          .ap-steps-grid { flex-direction: column; gap: 0; }
          .ap-step-connector { width: 2px; height: 32px; }
          .ap-reports { grid-template-columns: 1fr; }
          .ap-reports-visual { order: -1; }
        }
        @media (max-width: 600px) {
          .aismmpage { padding: 24px 16px 48px; }
          .ap-features-grid { grid-template-columns: 1fr; }
          .ap-feature-highlight { grid-column: span 1; }
          .ap-phone { width: 260px; }
          .ap-credit-packs { flex-direction: column; align-items: center; }
          .ap-pack-card { width: 100%; max-width: 280px; }
          .ap-final-cta { padding: 40px 24px; }
          .ap-referral-card { padding: 32px 24px; }
        }
      `}</style>

      <div className="aismmpage">

        {/* ── HERO ── */}
        <section className="ap-hero">
          <div className="ap-hero-content">
            <div className="ap-badge">
              <span className="ap-badge-dot"></span>
              {t('ai_smm_agent.badge')}
            </div>
            <h1>{t('ai_smm_agent.hero_title')}</h1>
            <p className="ap-hero-sub">
              {t('ai_smm_agent.hero_sub')}
            </p>
            <div className="ap-hero-actions">
              <a className="ap-btn ap-btn-telegram ap-btn-large" href="https://t.me/Aismmagentbot" target="_blank" rel="noopener noreferrer">
                {t('ai_smm_agent.cta_start')}
              </a>
              <a className="ap-btn ap-btn-secondary" href="#ap-features">
                {t('ai_smm_agent.cta_features')}
              </a>
            </div>
            <div className="ap-hero-stats">
              <div className="ap-stat-item">
                <span className="ap-stat-number">8</span>
                <span className="ap-stat-label">{t('ai_smm_agent.stat_platforms')}</span>
              </div>
              <div className="ap-stat-divider"></div>
              <div className="ap-stat-item">
                <span className="ap-stat-number">83</span>
                <span className="ap-stat-label">{t('ai_smm_agent.stat_languages')}</span>
              </div>
              <div className="ap-stat-divider"></div>
              <div className="ap-stat-item">
                <span className="ap-stat-number">24/7</span>
                <span className="ap-stat-label">{t('ai_smm_agent.stat_monitoring')}</span>
              </div>
            </div>
          </div>

          <div className="ap-hero-visual">
            <div className="ap-phone">
              <div className="ap-phone-notch"></div>
              <div className="ap-phone-screen">
                <div className="ap-chat-header">
                  <div className="ap-chat-avatar">AI</div>
                  <div>
                    <div className="ap-chat-name">AI SMM Agent</div>
                    <div className="ap-chat-status">{t('ai_smm_agent.chat_status')}</div>
                  </div>
                </div>
                <div className="ap-chat-messages">
                  <div className="ap-chat-msg bot">{t('ai_smm_agent.chat_msg1')}</div>
                  <div className="ap-chat-msg user">{t('ai_smm_agent.chat_msg2')}</div>
                  <div className="ap-chat-msg bot">{t('ai_smm_agent.chat_msg3')}</div>
                  <div className="ap-chat-msg user">{t('ai_smm_agent.chat_msg4')}</div>
                  <div className="ap-chat-msg bot">{t('ai_smm_agent.chat_msg5')}</div>
                </div>
                <div className="ap-chat-input">{t('ai_smm_agent.chat_input')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PLATFORMS BAR ── */}
        <section className="ap-platforms">
          <p className="ap-platforms-label">{t('ai_smm_agent.platforms_label')}</p>
          <div className="ap-platforms-list">
            {['Instagram','TikTok','YouTube','Facebook','X (Twitter)','LinkedIn','Threads','Pinterest'].map(p => (
              <div key={p} className="ap-platform-pill">{p}</div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="ap-features" id="ap-features">
          <div className="ap-section-heading">
            <h2>{t('ai_smm_agent.features_title')}</h2>
            <p>{t('ai_smm_agent.features_sub')}</p>
          </div>
          <div className="ap-features-grid">
            <article className="ap-feature-card ap-feature-highlight">
              <div className="ap-feature-icon">🎬</div>
              <h3>{t('ai_smm_agent.f1_title')}</h3>
              <p>{t('ai_smm_agent.f1_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f1_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">📸</div>
              <h3>{t('ai_smm_agent.f2_title')}</h3>
              <p>{t('ai_smm_agent.f2_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f2_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">📤</div>
              <h3>{t('ai_smm_agent.f3_title')}</h3>
              <p>{t('ai_smm_agent.f3_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f3_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">📊</div>
              <h3>{t('ai_smm_agent.f4_title')}</h3>
              <p>{t('ai_smm_agent.f4_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f4_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">👀</div>
              <h3>{t('ai_smm_agent.f5_title')}</h3>
              <p>{t('ai_smm_agent.f5_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f5_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">🤖</div>
              <h3>{t('ai_smm_agent.f6_title')}</h3>
              <p>{t('ai_smm_agent.f6_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f6_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">✍️</div>
              <h3>{t('ai_smm_agent.f7_title')}</h3>
              <p>{t('ai_smm_agent.f7_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f7_tag')}</div>
            </article>
            <article className="ap-feature-card">
              <div className="ap-feature-icon">🔥</div>
              <h3>{t('ai_smm_agent.f8_title')}</h3>
              <p>{t('ai_smm_agent.f8_body')}</p>
              <div className="ap-feature-tag">{t('ai_smm_agent.f8_tag')}</div>
            </article>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="ap-steps">
          <div className="ap-section-heading">
            <h2>{t('ai_smm_agent.steps_title')}</h2>
            <p>{t('ai_smm_agent.steps_sub')}</p>
          </div>
          <div className="ap-steps-grid">
            <div className="ap-step-card">
              <div className="ap-step-number">1</div>
              <h3>{t('ai_smm_agent.step1_title')}</h3>
              <p>{t('ai_smm_agent.step1_body')}</p>
            </div>
            <div className="ap-step-connector"></div>
            <div className="ap-step-card">
              <div className="ap-step-number">2</div>
              <h3>{t('ai_smm_agent.step2_title')}</h3>
              <p>{t('ai_smm_agent.step2_body')}</p>
            </div>
            <div className="ap-step-connector"></div>
            <div className="ap-step-card">
              <div className="ap-step-number">3</div>
              <h3>{t('ai_smm_agent.step3_title')}</h3>
              <p>{t('ai_smm_agent.step3_body')}</p>
            </div>
          </div>
        </section>

        {/* ── PDF REPORTS ── */}
        <section className="ap-reports">
          <div className="ap-reports-content">
            <h2>{t('ai_smm_agent.reports_title')}</h2>
            <p>{t('ai_smm_agent.reports_body')}</p>
            <ul className="ap-reports-list">
              <li>{t('ai_smm_agent.report_item1')}</li>
              <li>{t('ai_smm_agent.report_item2')}</li>
              <li>{t('ai_smm_agent.report_item3')}</li>
              <li>{t('ai_smm_agent.report_item4')}</li>
            </ul>
            <a className="ap-btn ap-btn-primary" href="https://t.me/Aismmagentbot" target="_blank" rel="noopener noreferrer">
              {t('ai_smm_agent.reports_cta')}
            </a>
          </div>
          <div className="ap-reports-visual">
            <div className="ap-report-mockup">
              <div className="ap-report-header">
                <div className="ap-report-logo">AI SMM</div>
                <div className="ap-report-title-text">{t('ai_smm_agent.report_mock_title')}</div>
              </div>
              <div className="ap-report-chart">
                <div className="ap-chart-bar" style={{height:'40%'}}></div>
                <div className="ap-chart-bar" style={{height:'65%'}}></div>
                <div className="ap-chart-bar highlight" style={{height:'85%'}}></div>
                <div className="ap-chart-bar" style={{height:'55%'}}></div>
                <div className="ap-chart-bar" style={{height:'70%'}}></div>
                <div className="ap-chart-bar" style={{height:'90%'}}></div>
              </div>
              <div className="ap-report-metrics">
                <div className="ap-report-metric">
                  <span className="ap-metric-value">4.2%</span>
                  <span className="ap-metric-label">ER</span>
                </div>
                <div className="ap-report-metric">
                  <span className="ap-metric-value">12.5K</span>
                  <span className="ap-metric-label">{t('ai_smm_agent.report_followers')}</span>
                </div>
                <div className="ap-report-metric">
                  <span className="ap-metric-value">+23%</span>
                  <span className="ap-metric-label">{t('ai_smm_agent.report_growth')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className="ap-pricing">
          <div className="ap-section-heading">
            <h2>{t('ai_smm_agent.pricing_title')}</h2>
            <p>{t('ai_smm_agent.pricing_sub')}</p>
          </div>
          <div className="ap-pricing-table-wrap">
            <table className="ap-pricing-table">
              <thead>
                <tr>
                  <th>{t('ai_smm_agent.price_col_feature')}</th>
                  <th>{t('ai_smm_agent.price_col_cost')}</th>
                </tr>
              </thead>
              <tbody>
                {([
                  [t('ai_smm_agent.price_r1'),'50'],
                  [t('ai_smm_agent.price_r2'),'+100'],
                  [t('ai_smm_agent.price_r3'),'20'],
                  [t('ai_smm_agent.price_r4'),'10'],
                  [t('ai_smm_agent.price_r5'),'50'],
                  [t('ai_smm_agent.price_r6'),'60'],
                  [t('ai_smm_agent.price_r7'),'10'],
                  [t('ai_smm_agent.price_r8'),'20'],
                  [t('ai_smm_agent.price_r9'),'1'],
                  [t('ai_smm_agent.price_r10'),'50'],
                ] as [string,string][]).map(([feature, cost]) => (
                  <tr key={feature}>
                    <td>{feature}</td>
                    <td>{cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ap-credit-packs">
            <div className="ap-pack-card">
              <div className="ap-pack-credits">100</div>
              <div className="ap-pack-label">{t('ai_smm_agent.pack_credits')}</div>
              <div className="ap-pack-price">$1</div>
            </div>
            <div className="ap-pack-card ap-pack-popular">
              <div className="ap-pack-badge">{t('ai_smm_agent.pack_popular')}</div>
              <div className="ap-pack-credits">600</div>
              <div className="ap-pack-label">{t('ai_smm_agent.pack_credits')}</div>
              <div className="ap-pack-price">$5</div>
            </div>
            <div className="ap-pack-card">
              <div className="ap-pack-credits">1300</div>
              <div className="ap-pack-label">{t('ai_smm_agent.pack_credits')}</div>
              <div className="ap-pack-price">$10</div>
            </div>
          </div>
        </section>

        {/* ── REFERRAL ── */}
        <section className="ap-referral">
          <div className="ap-referral-card">
            <div className="ap-referral-icon">🎁</div>
            <h2>{t('ai_smm_agent.referral_title')}</h2>
            <p>{t('ai_smm_agent.referral_body')}</p>
            <a className="ap-btn ap-btn-primary" href="https://t.me/Aismmagentbot" target="_blank" rel="noopener noreferrer">
              {t('ai_smm_agent.referral_cta')}
            </a>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="ap-final-cta">
          <h2>{t('ai_smm_agent.final_title')}</h2>
          <p>{t('ai_smm_agent.final_sub')}</p>
          <a className="ap-btn ap-btn-telegram ap-btn-large" href="https://t.me/Aismmagentbot" target="_blank" rel="noopener noreferrer">
            {t('ai_smm_agent.final_cta')}
          </a>
        </section>

      </div>
    </Layout>
  )
}
