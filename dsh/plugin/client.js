window.__ModuleLoader__.load({
  id: 'dsh-tavern-pixel-gunplay',
  factory: require => {
    const React = require('react'), h = React.createElement;
    return {
      name: 'dsh-tavern-pixel-gunplay', inject: ['tavernUi'],
      apply(ctx) {
        try {
          let active = null;
          function Battlefield({ close }) {
            const frame = React.useRef(null);
            React.useLayoutEffect(() => () => {
              const game = frame.current?.contentWindow?.game;
              if (game) {
                game.audio.stopAll();
                game.audio.ctx?.close().catch(() => {});
                game.renderer.dispose();
              }
            }, []);
            const [html, setHtml] = React.useState(null);
            const [error, setError] = React.useState('');
            React.useEffect(() => {
              const abort = new AbortController();
              fetch(ctx.tavernUi.assetUrl('game.html'), { signal: abort.signal })
                .then(r => { if (!r.ok) throw new Error(`游戏加载失败 (${r.status})`); return r.text(); })
                .then(setHtml).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
              return () => abort.abort();
            }, []);
            return h('div', { style: { position: 'absolute', inset: 0, background: '#080c10', color: '#fff', display: 'flex', flexDirection: 'column' } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', flexShrink: 0 } },
                h('strong', null, '现代战线'),
                h('span', { style: { flex: 1, fontSize: 12 } }, 'Esc 暂停并释放鼠标 · 关闭战场将结束当前比赛'),
                h('button', { onClick: close, style: { padding: '6px 16px', cursor: 'pointer' } }, '返回酒馆')),
              error ? h('p', { role: 'alert' }, error) : html ? h('iframe', {
                title: '现代战线战场', srcDoc: html, ref: frame,
                allow: 'fullscreen; autoplay', allowFullScreen: true,
                style: { width: '100%', flex: 1, minHeight: 0, border: 0 },
              }) : h('p', null, '正在载入战场…'));
          }
          const launch = ({ gameId }) => {
            if (active) return;
            active = ctx.tavernUi.openOverlay({ gameId, dismissible: false,
              render: ({ close }) => h(Battlefield, { close }), onClose: () => { active = null; } });
          };
          ctx.tavernUi.registerComposerAction({ id: 'battlefield', label: '进入战场', run: launch });
          ctx.tavernUi.registerMessageAction({ id: 'battlefield', label: '进入战场', run: launch });
        } catch (e) { console.error('[pixel-gunplay] 加载失败', e); }
      },
    };
  },
});
