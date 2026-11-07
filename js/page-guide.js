import { escape as esc } from './model.js';
import { GUIDES, getGuide } from './guide-content.js';

export function initPageGuides({ getPolicyPage = () => 'agenda' } = {}) {
  const drawer = document.createElement('dialog');
  drawer.id = 'page-guide';
  drawer.className = 'guide-drawer';
  drawer.setAttribute('aria-labelledby', 'page-guide-title');
  drawer.setAttribute('aria-modal', 'true');
  drawer.innerHTML = '<div id="page-guide-content"></div>';
  document.body.append(drawer);
  let opener = null;

  function close() {
    if (drawer.open) drawer.close();
  }

  function open(page, button) {
    const guide = getGuide(page, getPolicyPage());
    const existingDialog = document.getElementById('dialog');
    if (existingDialog?.open) existingDialog.close();
    opener = button;
    drawer.dataset.page = page;
    drawer.querySelector('#page-guide-content').innerHTML = `
      <div class="guide-header">
        <div><span class="eyebrow">POLITICS NOTE / ${esc(guide.label)}</span>
        <h2 id="page-guide-title" tabindex="-1">${esc(guide.title)}</h2>
        <p>${esc(guide.intro)}</p></div>
        <button class="guide-close" data-close-page-guide aria-label="解説を閉じる">×</button>
      </div>
      <div class="guide-body">
        ${guide.context ? `<p class="guide-context">${esc(guide.context)}</p>` : ''}
        <section class="guide-section"><h3>${esc(guide.question)}</h3><p>${esc(guide.answer)}</p></section>
        ${guide.visuals.map(visual => `<section class="knowledge-visual"><h3>${esc(visual.title)}</h3><div class="knowledge-cards knowledge-${esc(visual.type)}">${visual.items.map(item => `<div class="knowledge-card"><h4>${esc(item.label)}</h4><p>${esc(item.text)}</p></div>`).join('')}</div>${visual.caption ? `<p class="knowledge-caption">${esc(visual.caption)}</p>` : ''}</section>`).join('')}
        <section class="guide-section"><h3>気になる疑問から、もう少し詳しく</h3>
          <div class="guide-terms">${guide.terms.map(term => `<details><summary>${esc(term.title)}</summary><p>${esc(term.text)}</p></details>`).join('')}</div>
        </section>
        <aside class="guide-note"><h3>ニュースを読むときのヒント</h3><p>${esc(guide.hint)}</p></aside>
        <section class="guide-sources"><h3>制度をもう少し詳しく</h3><ul>${guide.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a></li>`).join('')}</ul></section>
      </div>
      <div class="guide-footer"><button class="subtle-button" data-close-page-guide>閉じる</button></div>`;
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('guide-open');
    drawer.showModal();
    drawer.querySelector('#page-guide-title').focus({ preventScroll: true });
  }

  for (const [page] of Object.entries(GUIDES)) {
    const view = document.querySelector(`[data-view="${page}"]`);
    const heading = view?.querySelector('.view-heading, .section-heading');
    if (!heading) continue;
    const actions = document.createElement('div');
    actions.className = 'view-tools';
    while (heading.children.length > 1) actions.append(heading.children[1]);
    const button = document.createElement('button');
    button.className = 'page-guide-button';
    button.type = 'button';
    button.dataset.helpFor = page;
    button.setAttribute('aria-label', `${GUIDES[page].label}：政治の基礎知識`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', drawer.id);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span aria-hidden="true">ⓘ</span> 政治の基礎知識';
    button.addEventListener('click', () => open(page, button));
    actions.append(button);
    heading.append(actions);
  }

  drawer.addEventListener('click', event => {
    if (event.target.closest('[data-close-page-guide]')) { close(); return; }
    if (event.target !== drawer) return;
    const rect = drawer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  drawer.addEventListener('cancel', event => { event.preventDefault(); close(); });
  drawer.addEventListener('close', () => {
    document.documentElement.classList.remove('guide-open');
    if (opener) {
      opener.setAttribute('aria-expanded', 'false');
      if (opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    }
  });
  return { close };
}
