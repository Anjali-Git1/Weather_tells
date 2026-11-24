const state = {
  raw: '',
  formatted: '',
  hasData: false,
  activeTab: 'formatted',
  copyTimer: null,
};

const dom = {
  view: document.getElementById('json-view'),
  formattedTab: document.getElementById('tab-formatted'),
  rawTab: document.getElementById('tab-raw'),
  copyButton: document.getElementById('copy-json'),
  copyLabel: document.getElementById('copy-label'),
  copyIcon: document.getElementById('copy-icon-use'),
  size: document.getElementById('json-size'),
};

let notify = () => {};

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    return '&gt;';
  });
}

function highlightJson(json) {
  const tokenPattern = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

  return escapeHtml(json).replace(tokenPattern, (match) => {
    let className = 'json-number';

    if (match.startsWith('"')) {
      className = /:\s*$/.test(match) ? 'json-key' : 'json-string';
    } else if (match === 'true' || match === 'false') {
      className = 'json-boolean';
    } else if (match === 'null') {
      className = 'json-null';
    }

    return `<span class="${className}">${match}</span>`;
  });
}

function formatBytes(text) {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function render() {
  if (!state.hasData) {
    dom.view.textContent = 'Waiting for the first successful weather response…';
    dom.size.textContent = '0 B';
    return;
  }

  if (state.activeTab === 'formatted') {
    dom.view.innerHTML = highlightJson(state.formatted);
  } else {
    dom.view.textContent = state.raw;
  }

  dom.view.scrollTop = 0;
  dom.view.setAttribute(
    'aria-labelledby',
    state.activeTab === 'formatted' ? 'tab-formatted' : 'tab-raw',
  );
}

function setActiveTab(tab, { focus = false } = {}) {
  if (tab !== 'formatted' && tab !== 'raw') return;
  state.activeTab = tab;

  const isFormatted = tab === 'formatted';
  dom.formattedTab.classList.toggle('is-active', isFormatted);
  dom.rawTab.classList.toggle('is-active', !isFormatted);
  dom.formattedTab.setAttribute('aria-selected', String(isFormatted));
  dom.rawTab.setAttribute('aria-selected', String(!isFormatted));
  dom.formattedTab.tabIndex = isFormatted ? 0 : -1;
  dom.rawTab.tabIndex = isFormatted ? -1 : 0;

  render();

  if (focus) {
    (isFormatted ? dom.formattedTab : dom.rawTab).focus();
  }
}

function resetCopyButton() {
  dom.copyButton.classList.remove('is-copied');
  dom.copyLabel.textContent = 'Copy';
  dom.copyIcon.setAttribute('href', '#i-copy');
}

function showCopyFeedback(success) {
  window.clearTimeout(state.copyTimer);
  dom.copyButton.classList.toggle('is-copied', success);
  dom.copyLabel.textContent = success ? 'Copied' : 'Copy failed';
  dom.copyIcon.setAttribute('href', success ? '#i-check' : '#i-copy');

  state.copyTimer = window.setTimeout(() => {
    resetCopyButton();
  }, 1800);
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the legacy clipboard path.
  }

  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.top = '-9999px';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(helper);

  if (!copied) throw new Error('Copy failed');
}

async function copyActiveView() {
  if (!state.hasData) return;

  const text = state.activeTab === 'formatted' ? state.formatted : state.raw;

  try {
    await writeClipboard(text);
    showCopyFeedback(true);
    notify(`${state.activeTab === 'formatted' ? 'Formatted' : 'Raw'} JSON copied`);
  } catch {
    showCopyFeedback(false);
    notify('Could not copy the JSON');
  }
}

function onTabKeydown(event) {
  const { key } = event;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;

  event.preventDefault();
  const tabs = ['formatted', 'raw'];
  const currentIndex = tabs.indexOf(state.activeTab);

  let nextIndex = currentIndex;
  if (key === 'ArrowLeft') nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
  if (key === 'ArrowRight') nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
  if (key === 'Home') nextIndex = 0;
  if (key === 'End') nextIndex = tabs.length - 1;

  setActiveTab(tabs[nextIndex], { focus: true });
}

export function initJsonViewer({ onCopy } = {}) {
  if (typeof onCopy === 'function') notify = onCopy;

  dom.formattedTab.addEventListener('click', () => setActiveTab('formatted'));
  dom.rawTab.addEventListener('click', () => setActiveTab('raw'));
  dom.formattedTab.addEventListener('keydown', onTabKeydown);
  dom.rawTab.addEventListener('keydown', onTabKeydown);
  dom.copyButton.addEventListener('click', copyActiveView);

  dom.copyButton.disabled = true;
  resetCopyButton();
  render();
}

export function setJsonResponse(raw, data) {
  state.raw = raw;
  state.formatted = JSON.stringify(data, null, 2);
  state.hasData = true;

  dom.copyButton.disabled = false;
  dom.size.textContent = formatBytes(raw);

  render();
}

export function resetJsonViewer() {
  state.raw = '';
  state.formatted = '';
  state.hasData = false;
  dom.copyButton.disabled = true;
  resetCopyButton();
  render();
}
