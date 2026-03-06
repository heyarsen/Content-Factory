import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout/Layout'
import { useLanguage } from '../contexts/LanguageContext'

export default function AiAutomation() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleStartAutomation = () => {
    navigate('/planning', { state: { openAutomation: true } })
  }

  return (
    <Layout>
      <style>{`
        .autopage {
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
        .au-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 24px; border-radius: 999px; text-decoration: none;
          font-weight: 600; font-size: 15px; border: 1px solid transparent;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .au-btn-primary {
          background: #2563eb; color: white;
          box-shadow: 0 12px 30px rgba(37,99,235,0.25);
        }
        .au-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(37,99,235,0.35); }
        .au-btn-secondary {
          background: rgba(255,255,255,0.7); color: #0f172a;
          border: 1px solid rgba(148,163,184,0.35);
        }
        .au-btn-secondary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(15,23,42,0.1); }
        .au-btn-cta {
          background: linear-gradient(135deg, #2563eb, #7c3aed); color: white;
          box-shadow: 0 12px 30px rgba(37,99,235,0.3);
          font-size: 16px; padding: 16px 36px;
        }
        .au-btn-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(37,99,235,0.4); }
        .au-btn-large { font-size: 17px; padding: 18px 40px; }

        /* ── Hero ── */
        .au-hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
          padding: 40px 0 64px;
        }
        .au-hero-content { display: flex; flex-direction: column; gap: 24px; }
        .au-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, rgba(37,99,235,0.1), rgba(124,58,237,0.1));
          border: 1px solid rgba(37,99,235,0.2);
          color: #2563eb;
          font-weight: 600; font-size: 13px;
          padding: 6px 16px; border-radius: 999px;
          width: fit-content;
        }
        .au-badge-dot {
          display: inline-block; width: 8px; height: 8px;
          background: #2563eb; border-radius: 50%;
          animation: au-pulse 2s infinite;
        }
        @keyframes au-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .au-hero h1 {
          font-size: clamp(30px, 4vw, 50px);
          font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
          background: linear-gradient(135deg, #0f172a 0%, #2563eb 60%, #7c3aed 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin: 0;
        }
        .au-hero-sub { font-size: 18px; line-height: 1.6; color: #475569; max-width: 520px; margin: 0; }
        .au-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }
        .au-hero-stats {
          display: flex; gap: 24px; align-items: center;
          padding: 20px 0; margin-top: 8px;
        }
        .au-stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .au-stat-number { font-size: 28px; font-weight: 800; color: #2563eb; line-height: 1; }
        .au-stat-label { font-size: 12px; color: #64748b; font-weight: 500; text-align: center; }
        .au-stat-divider { width: 1px; height: 40px; background: #e2e8f0; }

        /* ── Hero Visual: Pipeline ── */
        .au-hero-visual { display: flex; justify-content: center; align-items: center; }
        .au-pipeline-card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(15,23,42,0.12);
          padding: 28px 24px;
          width: 100%;
          max-width: 360px;
          border: 1px solid rgba(148,163,184,0.15);
        }
        .au-pipeline-title {
          font-size: 13px; font-weight: 700; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 20px;
        }
        .au-pipeline-steps { display: flex; flex-direction: column; gap: 0; }
        .au-pipeline-step {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 0;
        }
        .au-pipeline-step:not(:last-child) {
          border-bottom: 1px dashed #e2e8f0;
        }
        .au-step-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .au-step-icon-1 { background: #eff6ff; }
        .au-step-icon-2 { background: #f0fdf4; }
        .au-step-icon-3 { background: #fdf4ff; }
        .au-step-icon-4 { background: #fff7ed; }
        .au-step-text { display: flex; flex-direction: column; gap: 2px; }
        .au-step-name { font-size: 13px; font-weight: 700; color: #0f172a; }
        .au-step-desc { font-size: 12px; color: #64748b; line-height: 1.4; }
        .au-pipeline-footer {
          margin-top: 16px; padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          display: flex; align-items: center; gap: 8px;
        }
        .au-pipeline-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: au-pulse 2s infinite; }
        .au-pipeline-status { font-size: 12px; font-weight: 600; color: #22c55e; }

        /* ── Section headings ── */
        .au-section-heading { text-align: center; margin-bottom: 48px; }
        .au-section-heading h2 {
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin: 0 0 12px;
        }
        .au-section-heading p { font-size: 17px; color: #64748b; max-width: 600px; margin: 0 auto; }

        /* ── Settings section ── */
        .au-settings { padding: 64px 0; }
        .au-settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
        }
        .au-setting-card {
          background: white;
          border-radius: 16px;
          padding: 28px 24px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 16px rgba(15,23,42,0.06);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex; flex-direction: column; gap: 12px;
        }
        .au-setting-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(15,23,42,0.1); }
        .au-setting-icon {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .au-setting-icon-blue { background: #eff6ff; }
        .au-setting-icon-purple { background: #faf5ff; }
        .au-setting-icon-green { background: #f0fdf4; }
        .au-setting-icon-orange { background: #fff7ed; }
        .au-setting-card h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
        .au-setting-card p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0; }
        .au-setting-tag {
          display: inline-flex; align-items: center;
          background: #f1f5f9; color: #475569;
          font-size: 11px; font-weight: 600;
          padding: 4px 10px; border-radius: 999px;
          width: fit-content;
        }

        /* ── How it works ── */
        .au-how { padding: 64px 0; }
        .au-how-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0;
          position: relative;
        }
        .au-how-step {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 32px 20px;
          position: relative;
        }
        .au-how-step:not(:last-child)::after {
          content: '→';
          position: absolute; right: -12px; top: 50%;
          transform: translateY(-50%);
          font-size: 20px; color: #cbd5e1;
          z-index: 1;
        }
        .au-how-num {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white; font-size: 20px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 20px rgba(37,99,235,0.25);
        }
        .au-how-step h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
        .au-how-step p { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0; }

        /* ── Benefits ── */
        .au-benefits { padding: 64px 0; }
        .au-benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: center;
        }
        .au-benefits-list { display: flex; flex-direction: column; gap: 16px; }
        .au-benefit-item {
          display: flex; align-items: flex-start; gap: 16px;
          background: white; border-radius: 14px;
          padding: 20px; border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
        }
        .au-benefit-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
          background: linear-gradient(135deg, #eff6ff, #faf5ff);
        }
        .au-benefit-text h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
        .au-benefit-text p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.4; }
        .au-benefits-visual {
          background: white; border-radius: 20px;
          padding: 32px; border: 1px solid #e2e8f0;
          box-shadow: 0 16px 48px rgba(15,23,42,0.08);
        }
        .au-chart-title { font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.06em; }
        .au-chart-bars {
          display: flex; align-items: flex-end; gap: 8px;
          height: 140px; margin-bottom: 12px;
        }
        .au-bar-wrap { display: flex; flex-direction: column-reverse; align-items: center; gap: 4px; flex: 1; height: 100%; }
        .au-bar {
          width: 100%; border-radius: 6px 6px 0 0;
          background: linear-gradient(180deg, #2563eb, #7c3aed);
          transition: height 0.5s ease;
          min-height: 4px;
        }
        .au-bar-label { font-size: 10px; color: #94a3b8; font-weight: 500; flex-shrink: 0; }
        .au-chart-metrics {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; margin-top: 16px; padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }
        .au-metric { text-align: center; }
        .au-metric-val { font-size: 20px; font-weight: 800; color: #2563eb; }
        .au-metric-lbl { font-size: 11px; color: #94a3b8; font-weight: 500; }

        /* ── Platforms ── */
        .au-platforms { padding: 32px 0; text-align: center; }
        .au-platforms-label { font-size: 14px; color: #94a3b8; font-weight: 500; margin-bottom: 16px; }
        .au-platforms-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .au-platform-pill {
          background: white; border: 1px solid #e2e8f0;
          border-radius: 999px; padding: 8px 18px;
          font-size: 13px; font-weight: 600; color: #475569;
          box-shadow: 0 2px 8px rgba(15,23,42,0.05);
        }

        /* ── Final CTA ── */
        .au-final-cta {
          text-align: center; padding: 80px 32px;
          background: linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #4c1d95 100%);
          border-radius: 24px; margin-top: 32px;
          color: white;
        }
        .au-final-cta h2 {
          font-size: clamp(26px, 3.5vw, 42px);
          font-weight: 800; margin: 0 0 16px; letter-spacing: -0.02em;
        }
        .au-final-cta p { font-size: 18px; opacity: 0.8; margin: 0 0 36px; }
        .au-btn-white {
          background: white; color: #1e3a8a;
          box-shadow: 0 12px 30px rgba(0,0,0,0.2);
          font-size: 16px; padding: 16px 36px;
        }
        .au-btn-white:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(0,0,0,0.3); }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .au-hero { grid-template-columns: 1fr; gap: 32px; padding: 24px 0 40px; }
          .au-benefits-grid { grid-template-columns: 1fr; }
          .au-how-step:not(:last-child)::after { display: none; }
          .au-how-grid { gap: 16px; }
        }
      `}</style>

      <div className="autopage">

        {/* ── HERO ── */}
        <section className="au-hero">
          <div className="au-hero-content">
            <div className="au-badge">
              <span className="au-badge-dot"></span>
              {t('ai_automation.badge')}
            </div>
            <h1>{t('ai_automation.hero_title')}</h1>
            <p className="au-hero-sub">{t('ai_automation.hero_sub')}</p>
            <div className="au-hero-actions">
              <button className="au-btn au-btn-cta au-btn-large" onClick={handleStartAutomation}>
                {t('ai_automation.cta_start')}
              </button>
            </div>
            <div className="au-hero-stats">
              <div className="au-stat-item">
                <span className="au-stat-number">24/7</span>
                <span className="au-stat-label">{t('ai_automation.stat_posting')}</span>
              </div>
              <div className="au-stat-divider"></div>
              <div className="au-stat-item">
                <span className="au-stat-number">4</span>
                <span className="au-stat-label">{t('ai_automation.stat_platforms')}</span>
              </div>
              <div className="au-stat-divider"></div>
              <div className="au-stat-item">
                <span className="au-stat-number">∞</span>
                <span className="au-stat-label">{t('ai_automation.stat_growth')}</span>
              </div>
            </div>
          </div>

          <div className="au-hero-visual">
            <div className="au-pipeline-card">
              <div className="au-pipeline-title">{t('ai_automation.pipeline_title')}</div>
              <div className="au-pipeline-steps">
                <div className="au-pipeline-step">
                  <div className="au-step-icon au-step-icon-1">🔍</div>
                  <div className="au-step-text">
                    <div className="au-step-name">{t('ai_automation.pipe_step1_name')}</div>
                    <div className="au-step-desc">{t('ai_automation.pipe_step1_desc')}</div>
                  </div>
                </div>
                <div className="au-pipeline-step">
                  <div className="au-step-icon au-step-icon-2">✍️</div>
                  <div className="au-step-text">
                    <div className="au-step-name">{t('ai_automation.pipe_step2_name')}</div>
                    <div className="au-step-desc">{t('ai_automation.pipe_step2_desc')}</div>
                  </div>
                </div>
                <div className="au-pipeline-step">
                  <div className="au-step-icon au-step-icon-3">🎬</div>
                  <div className="au-step-text">
                    <div className="au-step-name">{t('ai_automation.pipe_step3_name')}</div>
                    <div className="au-step-desc">{t('ai_automation.pipe_step3_desc')}</div>
                  </div>
                </div>
                <div className="au-pipeline-step">
                  <div className="au-step-icon au-step-icon-4">📤</div>
                  <div className="au-step-text">
                    <div className="au-step-name">{t('ai_automation.pipe_step4_name')}</div>
                    <div className="au-step-desc">{t('ai_automation.pipe_step4_desc')}</div>
                  </div>
                </div>
              </div>
              <div className="au-pipeline-footer">
                <div className="au-pipeline-dot"></div>
                <div className="au-pipeline-status">{t('ai_automation.pipeline_status')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PLATFORMS ── */}
        <section className="au-platforms">
          <p className="au-platforms-label">{t('ai_automation.platforms_label')}</p>
          <div className="au-platforms-list">
            {['Instagram','TikTok','YouTube Shorts','Facebook'].map(p => (
              <div key={p} className="au-platform-pill">{p}</div>
            ))}
          </div>
        </section>

        {/* ── SETTINGS ── */}
        <section className="au-settings">
          <div className="au-section-heading">
            <h2>{t('ai_automation.settings_title')}</h2>
            <p>{t('ai_automation.settings_sub')}</p>
          </div>
          <div className="au-settings-grid">
            <div className="au-setting-card">
              <div className="au-setting-icon au-setting-icon-blue">📅</div>
              <h3>{t('ai_automation.s1_title')}</h3>
              <p>{t('ai_automation.s1_body')}</p>
              <div className="au-setting-tag">{t('ai_automation.s1_tag')}</div>
            </div>
            <div className="au-setting-card">
              <div className="au-setting-icon au-setting-icon-purple">💡</div>
              <h3>{t('ai_automation.s2_title')}</h3>
              <p>{t('ai_automation.s2_body')}</p>
              <div className="au-setting-tag">{t('ai_automation.s2_tag')}</div>
            </div>
            <div className="au-setting-card">
              <div className="au-setting-icon au-setting-icon-green">⏰</div>
              <h3>{t('ai_automation.s3_title')}</h3>
              <p>{t('ai_automation.s3_body')}</p>
              <div className="au-setting-tag">{t('ai_automation.s3_tag')}</div>
            </div>
            <div className="au-setting-card">
              <div className="au-setting-icon au-setting-icon-orange">📲</div>
              <h3>{t('ai_automation.s4_title')}</h3>
              <p>{t('ai_automation.s4_body')}</p>
              <div className="au-setting-tag">{t('ai_automation.s4_tag')}</div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="au-how">
          <div className="au-section-heading">
            <h2>{t('ai_automation.how_title')}</h2>
            <p>{t('ai_automation.how_sub')}</p>
          </div>
          <div className="au-how-grid">
            <div className="au-how-step">
              <div className="au-how-num">1</div>
              <h3>{t('ai_automation.how_step1_title')}</h3>
              <p>{t('ai_automation.how_step1_body')}</p>
            </div>
            <div className="au-how-step">
              <div className="au-how-num">2</div>
              <h3>{t('ai_automation.how_step2_title')}</h3>
              <p>{t('ai_automation.how_step2_body')}</p>
            </div>
            <div className="au-how-step">
              <div className="au-how-num">3</div>
              <h3>{t('ai_automation.how_step3_title')}</h3>
              <p>{t('ai_automation.how_step3_body')}</p>
            </div>
            <div className="au-how-step">
              <div className="au-how-num">4</div>
              <h3>{t('ai_automation.how_step4_title')}</h3>
              <p>{t('ai_automation.how_step4_body')}</p>
            </div>
          </div>
        </section>

        {/* ── BENEFITS ── */}
        <section className="au-benefits">
          <div className="au-section-heading">
            <h2>{t('ai_automation.benefits_title')}</h2>
            <p>{t('ai_automation.benefits_sub')}</p>
          </div>
          <div className="au-benefits-grid">
            <div className="au-benefits-list">
              <div className="au-benefit-item">
                <div className="au-benefit-icon">📈</div>
                <div className="au-benefit-text">
                  <h4>{t('ai_automation.b1_title')}</h4>
                  <p>{t('ai_automation.b1_body')}</p>
                </div>
              </div>
              <div className="au-benefit-item">
                <div className="au-benefit-icon">👥</div>
                <div className="au-benefit-text">
                  <h4>{t('ai_automation.b2_title')}</h4>
                  <p>{t('ai_automation.b2_body')}</p>
                </div>
              </div>
              <div className="au-benefit-item">
                <div className="au-benefit-icon">💰</div>
                <div className="au-benefit-text">
                  <h4>{t('ai_automation.b3_title')}</h4>
                  <p>{t('ai_automation.b3_body')}</p>
                </div>
              </div>
              <div className="au-benefit-item">
                <div className="au-benefit-icon">⚡</div>
                <div className="au-benefit-text">
                  <h4>{t('ai_automation.b4_title')}</h4>
                  <p>{t('ai_automation.b4_body')}</p>
                </div>
              </div>
            </div>
            <div className="au-benefits-visual">
              <div className="au-chart-title">{t('ai_automation.chart_title')}</div>
              <div className="au-chart-bars">
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'25%', opacity: 0.4}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w1')}</div>
                </div>
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'40%', opacity: 0.55}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w2')}</div>
                </div>
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'55%', opacity: 0.7}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w3')}</div>
                </div>
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'70%', opacity: 0.85}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w4')}</div>
                </div>
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'88%'}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w5')}</div>
                </div>
                <div className="au-bar-wrap">
                  <div className="au-bar" style={{height:'100%'}}></div>
                  <div className="au-bar-label">{t('ai_automation.chart_w6')}</div>
                </div>
              </div>
              <div className="au-chart-metrics">
                <div className="au-metric">
                  <div className="au-metric-val">+340%</div>
                  <div className="au-metric-lbl">{t('ai_automation.metric_reach')}</div>
                </div>
                <div className="au-metric">
                  <div className="au-metric-val">+5K</div>
                  <div className="au-metric-lbl">{t('ai_automation.metric_followers')}</div>
                </div>
                <div className="au-metric">
                  <div className="au-metric-val">×3</div>
                  <div className="au-metric-lbl">{t('ai_automation.metric_clients')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="au-final-cta">
          <h2>{t('ai_automation.final_title')}</h2>
          <p>{t('ai_automation.final_sub')}</p>
          <button className="au-btn au-btn-white au-btn-large" onClick={handleStartAutomation}>
            {t('ai_automation.final_cta')}
          </button>
        </section>

      </div>
    </Layout>
  )
}
