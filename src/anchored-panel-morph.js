/* =============================================================================
   МОРФИНГ: anchored-button <-> panel

   Идея: у каждой "летающей" кнопки (anchored-button), прикреплённой к точке
   на 3д-модели, есть своя панель настроек (.panel--anchored). Позицию кнопки
   каждый кадр пересчитывает main.js (updateButtonPosition), панель же после
   открытия должна быть НЕподвижной -- этого мы добиваемся не тем, что
   "останавливаем" 3д-цикл, а просто прячем кнопку (opacity: 0) на время,
   пока её панель открыта: main.js как ни в чём не бывало продолжает
   обновлять button.style.left/top в фоне, но это никак не видно.

   Открытие (клик по anchored-button):
     1. Берём текущий (спроецированный) прямоугольник кнопки.
     2. Ставим панель ровно на его место, того же размера и скругления --
        визуально это неотличимо от самой кнопки.
     3. Прячем кнопку, измеряем "естественный" размер панели (320px по CSS,
        высота -- по содержимому) и анимируем left/top/width/height/
        border-radius до этого размера (FLIP-подход).
     4. Когда рост завершён -- проявляем содержимое панели (ручка, крестик,
        заголовок, panel-content).

   Закрытие (клик по close-btn -> событие panelclose из panel-system.js):
     1. Прячем содержимое панели.
     2. Узнаём, где СЕЙЧАС (в этот самый момент) находится anchored-button --
        она всё это время двигалась вместе с моделью, просто была невидима.
     3. Анимируем панель обратно до размера/позиции/скругления кнопки.
     4. Когда анимация завершена -- прячем панель (display: none) и
        показываем кнопку ровно на том же месте, куда панель "приехала".
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const MORPH_DURATION_MS = 450; // держим в синхроне с transition в panel-system.css
  const EDGE_MARGIN = 16; // px, минимальный отступ панели от края её секции

  // Находим все пары кнопка <-> панель по data-anchor-panel="id-панели"
  const links = Array.from(
    document.querySelectorAll('.anchored-button[data-anchor-panel]')
  )
    .map((button) => ({
      button,
      panel: document.getElementById(button.dataset.anchorPanel),
    }))
    .filter((link) => {
      if (!link.panel) {
        console.warn(
          'anchored-panel-morph: не найдена панель для',
          link.button
        );
        return false;
      }
      return true;
    });

  if (!links.length) return;

  // Контейнер, относительно которого позиционируется панель (как в initDrag
  // из panel-system.js) -- обычно это .section, в котором она лежит.
  function getContainer(panel) {
    return panel.closest('.section') || document.body;
  }

  // Узнаём "естественный" размер панели -- тот, что задаёт её обычная CSS-
  // вёрстка (ширина 320px, высота по контенту). Делаем это невидимо для
  // пользователя (visibility: hidden), временно сняв инлайновые размеры,
  // после чего возвращаем всё как было.
  function measureNaturalSize(panel) {
    const savedCssText = panel.style.cssText;

    panel.style.transition = 'none';
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
    panel.style.position = 'absolute';
    panel.style.left = '0px';
    panel.style.top = '0px';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.borderRadius = '';

    void panel.offsetWidth; // форсируем reflow

    const size = { width: panel.offsetWidth, height: panel.offsetHeight };

    panel.style.cssText = savedCssText;

    return size;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function openPanel(link) {
    const { button, panel } = link;
    if (panel.classList.contains('panel--open')) return;

    const container = getContainer(panel);
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const startLeft = buttonRect.left - containerRect.left;
    const startTop = buttonRect.top - containerRect.top;
    const startSize = buttonRect.height; // anchored-button квадратная

    // 1. Прячем кнопку -- дальше main.js продолжит обновлять её позицию
    //    в фоне, но на экране это никак не видно.
    button.classList.add('anchored-button--hidden');

    // 2. Ставим панель ровно на место кнопки, того же размера/скругления,
    //    чтобы переход был бесшовным.
    panel.style.transition = 'none';
    panel.style.display = 'block';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    panel.style.width = startSize + 'px';
    panel.style.height = startSize + 'px';
    panel.style.borderRadius = startSize / 2 + 'px';
    panel.classList.add('panel--anchored', 'panel--morphing');
    panel.classList.remove('panel--content-visible');
    panel.classList.add('panel--open');

    // 3. Узнаём целевой размер и считаем целевую позицию так, чтобы
    //    панель не вылезала за пределы своей секции.
    const natural = measureNaturalSize(panel);
    const targetWidth = natural.width;
    const targetHeight = natural.height;

    const targetLeft = clamp(
      startLeft,
      EDGE_MARGIN,
      containerRect.width - targetWidth - EDGE_MARGIN
    );
    const targetTop = clamp(
      startTop,
      EDGE_MARGIN,
      containerRect.height - targetHeight - EDGE_MARGIN
    );

    void panel.offsetWidth; // форсируем reflow, чтобы transition:none точно применился

    // 4. Запускаем анимацию роста кнопки в панель.
    requestAnimationFrame(() => {
      panel.style.transition = '';
      panel.style.left = targetLeft + 'px';
      panel.style.top = targetTop + 'px';
      panel.style.width = targetWidth + 'px';
      panel.style.height = targetHeight + 'px';
      panel.style.borderRadius = '';
    });

    function finishOpening() {
      panel.classList.remove('panel--morphing');
      panel.classList.add('panel--content-visible');
      panel.removeEventListener('transitionend', onTransitionEnd);
    }

    function onTransitionEnd(e) {
      if (e.target !== panel || e.propertyName !== 'width') return;
      finishOpening();
    }

    panel.addEventListener('transitionend', onTransitionEnd);
    // подстраховка -- если transitionend по какой-то причине не сработает
    window.setTimeout(finishOpening, MORPH_DURATION_MS + 80);
  }

  function closePanel(link) {
    const { button, panel } = link;
    if (!panel.classList.contains('panel--open')) return;

    const container = getContainer(panel);
    const containerRect = container.getBoundingClientRect();

    // Кнопка всё это время двигалась вместе с моделью (просто была
    // невидима) -- сжимаем панель именно туда, где она сейчас находится.
    const buttonRect = button.getBoundingClientRect();
    const targetLeft = buttonRect.left - containerRect.left;
    const targetTop = buttonRect.top - containerRect.top;
    const targetSize = buttonRect.height;

    panel.classList.remove('panel--content-visible', 'panel--open');
    panel.classList.add('panel--morphing');

    // Фиксируем текущее (возможно, перетащенное пользователем) положение
    // панели явно в px, чтобы transition стартовал корректно.
    const currentRect = panel.getBoundingClientRect();
    panel.style.transition = 'none';
    panel.style.left = currentRect.left - containerRect.left + 'px';
    panel.style.top = currentRect.top - containerRect.top + 'px';
    panel.style.width = currentRect.width + 'px';
    panel.style.height = currentRect.height + 'px';
    void panel.offsetWidth; // reflow

    requestAnimationFrame(() => {
      panel.style.transition = '';
      panel.style.left = targetLeft + 'px';
      panel.style.top = targetTop + 'px';
      panel.style.width = targetSize + 'px';
      panel.style.height = targetSize + 'px';
      panel.style.borderRadius = targetSize / 2 + 'px';
    });

    function finishClosing() {
      panel.style.display = 'none';
      panel.classList.remove('panel--morphing');
      button.classList.remove('anchored-button--hidden');
      panel.removeEventListener('transitionend', onTransitionEnd);
    }

    function onTransitionEnd(e) {
      if (e.target !== panel || e.propertyName !== 'width') return;
      finishClosing();
    }

    panel.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finishClosing, MORPH_DURATION_MS + 80);
  }

  links.forEach((link) => {
    link.button.addEventListener('click', () => openPanel(link));
    // panelclose -- кастомное событие, которое диспатчит close-btn
    // из panel-system.js (initClose)
    link.panel.addEventListener('panelclose', () => closePanel(link));
  });

  // На resize окна пересчитывать открытые панели не будем -- пользователь
  // может перетащить панель сам через drag-handle, если она вдруг вылезла
  // за пределы секции.
});
