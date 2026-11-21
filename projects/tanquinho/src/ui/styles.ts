const FONT = '18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

export const SIMPLE_MODE_CLASS = 'tq-simple-mode';

export const STYLES = `
:root{--bg:#f3f5f9;--card:#fff;--text:#17202c;--muted:#566273;--primary:#1565d8;--on-primary:#fff;
--selected:#e7f0fd;--border:#d9e0ea;--danger:#c62828;--danger-bg:#fdecec;--ok:#1e8e4f;--ok-bg:#e6f5ec;
--warning:#8a5a00;--warning-bg:#fff4d6;--radius:18px}
@media (prefers-color-scheme:dark){:root{--bg:#0e131a;--card:#18202b;--text:#eef2f7;--muted:#a3afbf;
--primary:#6aa8ff;--on-primary:#0b1220;--selected:#1d2b40;--border:#2b3646;--danger:#ff6b6b;--danger-bg:#3a1c1f;
--ok:#4cc584;--ok-bg:#16301f;--warning:#ffd27a;--warning-bg:#3a2e12}}
body.${SIMPLE_MODE_CLASS} esp-app{display:none}
body:not(.${SIMPLE_MODE_CLASS}) #tq{display:none}
body.${SIMPLE_MODE_CLASS}{margin:0;background:var(--bg)}
#tq{font:${FONT};color:var(--text);max-width:480px;margin:0 auto;padding:12px 16px 0;box-sizing:border-box;min-height:100vh;display:flex;flex-direction:column}
#tq *{box-sizing:border-box}
#tq button{font:inherit;color:inherit;cursor:pointer;border-radius:14px;border:2px solid var(--border);background:var(--card);min-height:56px;-webkit-tap-highlight-color:transparent}
#tq button:disabled{opacity:.4;cursor:default}
#tq .top-bar{display:flex;align-items:center;gap:10px;margin-bottom:12px}
#tq .top-bar h1{font-size:22px;margin:0;flex:1}
#tq .top-bar button{white-space:nowrap}
#tq .status{display:block;font-size:14px;font-weight:400;color:var(--muted)}
#tq .status:before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ok);margin-right:6px;vertical-align:1px}
#tq.offline .status:before{background:var(--danger)}
#tq .power-off{min-height:48px;padding:0 14px;border-color:var(--danger);color:var(--danger);font-size:16px;font-weight:600}
#tq .offline-banner,#tq .manual-alert{border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:16px}
#tq .offline-banner{background:var(--danger);color:#fff;display:none}
#tq.offline .offline-banner{display:block}
#tq .manual-alert{background:var(--warning-bg);color:var(--warning);display:flex;align-items:center;gap:10px}
#tq .manual-alert span{flex:1}
#tq .manual-alert button{min-height:48px;padding:0 14px;border-color:currentColor;background:transparent;color:inherit;font-weight:600}
#tq .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
#tq h2{font-size:18px;margin:0 0 12px}
#tq .choices{display:grid;gap:10px}
#tq .choices--3{grid-template-columns:repeat(3,1fr)}
#tq .choices--2{grid-template-columns:1fr 1fr}
#tq .choices--5{grid-template-columns:repeat(5,1fr)}
#tq .choice{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 4px}
#tq .choice b{font-size:19px}
#tq .choice small{font-size:14px;color:var(--muted)}
#tq .choice[aria-pressed="true"]{border-color:var(--primary);background:var(--selected)}
#tq .choices--5 .choice b{font-size:22px}
#tq .action-bar{position:sticky;bottom:0;margin:auto -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(to top,var(--bg) 75%,transparent)}
#tq .action-bar button{width:100%;min-height:68px;border:0;font-weight:700;font-size:21px;display:flex;flex-direction:column;align-items:center;justify-content:center}
#tq .action-bar small{font-size:15px;font-weight:400;opacity:.9}
#tq .start{background:var(--primary);color:var(--on-primary)}
#tq .stop{background:var(--danger);color:#fff}
#tq .now{text-align:center}
#tq .now .icon{font-size:64px;display:inline-block;animation:tq-pulse 2s ease-in-out infinite}
#tq .now .stage{font-size:28px;font-weight:700;margin:4px 0 2px}
#tq .now .cycle{font-size:16px;color:var(--muted)}
#tq .timeline{display:flex;list-style:none;padding:0;margin:18px 0;gap:4px}
#tq .timeline li{flex:1;font-size:13px;color:var(--muted);padding-top:10px;border-top:5px solid var(--border)}
#tq .timeline li.done{border-color:var(--ok)}
#tq .timeline li.current{border-color:var(--primary);color:var(--text);font-weight:700}
#tq .finish{font-size:16px;color:var(--muted);margin-top:6px}
#tq .finish b{display:block;font-size:40px;color:var(--text);font-variant-numeric:tabular-nums}
#tq .progress{height:10px;background:var(--border);border-radius:6px;overflow:hidden;margin-top:12px}
#tq .progress i{display:block;height:100%;width:0;background:var(--ok);transition:width .8s}
#tq .outcome{text-align:center}
#tq .outcome.completed{background:var(--ok-bg);border-color:var(--ok)}
#tq .outcome.interrupted{background:var(--warning-bg);border-color:var(--warning)}
#tq .outcome .icon{font-size:48px}
#tq .outcome b{display:block;font-size:22px;margin:4px 0}
#tq .outcome p{margin:0 0 12px;font-size:16px}
#tq .outcome button{min-width:140px}
#tq .back{min-height:48px;padding:0 14px;margin-right:4px}
#tq .field{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0}
#tq .field input{width:96px;min-height:52px;font:inherit;text-align:center;border-radius:12px;border:2px solid var(--border);background:var(--bg);color:var(--text)}
#tq .note{font-size:15px;color:var(--muted);margin:0 0 10px}
#tq .relays{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#tq .relays button[aria-pressed="true"]{background:var(--ok);color:#fff;border-color:var(--ok)}
#tq .footer{display:flex;justify-content:center;gap:24px;margin:8px 0 4px}
#tq .footer button{border:0;background:transparent;min-height:48px;color:var(--muted);font-size:16px;text-decoration:underline}
#tq-sheet{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:20}
#tq-sheet.open{display:flex}
#tq-sheet .box{background:var(--card);color:var(--text);width:100%;max-width:480px;border-radius:22px 22px 0 0;padding:22px 16px calc(16px + env(safe-area-inset-bottom));font:${FONT}}
#tq-sheet h3{margin:0 0 6px;font-size:22px}
#tq-sheet p{margin:0 0 18px;color:var(--muted);font-size:16px}
#tq-sheet button{display:block;width:100%;min-height:60px;border-radius:14px;font:inherit;font-weight:700;margin-top:10px;cursor:pointer;border:2px solid var(--border);background:var(--card);color:var(--text)}
#tq-sheet .confirm{background:var(--danger);border-color:var(--danger);color:#fff}
#tq-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#222;color:#fff;padding:12px 16px;border-radius:12px;font:16px system-ui,sans-serif;display:none;z-index:30;max-width:90vw}
#tq-simple{position:fixed;right:12px;bottom:12px;z-index:10;padding:10px 14px;border-radius:12px;border:0;background:#1565d8;color:#fff;font:16px system-ui,sans-serif;min-height:48px}
body.${SIMPLE_MODE_CLASS} #tq-simple{display:none}
@keyframes tq-pulse{50%{transform:scale(1.08)}}
@media (prefers-reduced-motion:reduce){#tq .now .icon{animation:none}}
`;
