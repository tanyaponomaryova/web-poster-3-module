document.addEventListener('DOMContentLoaded', () => {
  /* =============================================================================
   ГЕНЕРИЧНОЕ ПОВЕДЕНИЕ ПАНЕЛЕЙ
   Ничего не завязано на конкретное число панелей или их содержимое.
   Скрипт находит на странице все .panel и подключает:
     1) перетаскивание за .drag-handle в пределах #container
     2) закрытие по .close-btn
     3) если внутри панели есть .hue-slider — работу color picker'а

   Чтобы добавить новую панель — просто скопируй блок <div class="panel">...</div>
   в HTML. Чтобы добавить в панель новые кнопки — добавь разметку в .panel-content
   и повесь свой обработчик отдельным addEventListener (пример внизу).
   ============================================================================= */

  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function hslToHex(h, s, l) {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // ---------- 1. Драг любой .panel за её .drag-handle ----------
  function initDrag(panel) {
    const handle = panel.querySelector('.drag-handle');
    // раньше контейнер был жёстко привязан к #creation-section —
    // теперь каждая панель ограничена своей собственной секцией
    // (например, панели фона/масштаба внутри #camera-section
    // будут таскаться в её границах, а не в границах редактора)
    const container = panel.closest('.section') || document.body;

    let dragging = false;
    let offsetX = 0,
      offsetY = 0;

    function down(e) {
      dragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = panel.getBoundingClientRect();
      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;
      e.preventDefault();
    }

    function move(e) {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const contRect = container.getBoundingClientRect();

      let newX = clientX - contRect.left - offsetX;
      let newY = clientY - contRect.top - offsetY;

      const maxX = container.clientWidth - panel.offsetWidth;
      const maxY = container.clientHeight - panel.offsetHeight;
      newX = Math.max(0, Math.min(maxX, newX));
      newY = Math.max(0, Math.min(maxY, newY));

      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';
      e.preventDefault();
    }

    function up() {
      dragging = false;
    }

    handle.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    handle.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
  }

  // ---------- 2. Закрытие любой .panel по её .close-btn ----------
  function initClose(panel) {
    const btn = panel.querySelector('.close-btn');
    btn.addEventListener('click', () => {
      panel.style.display = 'none';

      // ???
      panel.dispatchEvent(new CustomEvent('panelclose', { bubbles: true }));
    });
  }

  // ---------- 3. Любой .hue-slider на странице становится color picker'ом ----------
  function initHueSlider(slider) {
    // к какой панели относится этот слайдер?
    const panel = slider.closest('.panel');
    const targetName = panel.dataset.colorTarget;
    const thumb = slider.querySelector('.thumb');
    const thumbFill = slider.querySelector('.thumb-fill');
    const previewBubble = slider.querySelector('.preview-bubble');

    function applyHue(hue, ratio) {
      // hue -- это число от 0 до 360, защищаем о выхода за пределы:
      hue = Math.max(0, Math.min(360, hue));

      const hex = hslToHex(hue, 100, 55);
      const hsl = `hsl(${Math.round(hue)}, 100%, 55%)`;
      const color = { hue: Math.round(hue), hex, hsl };

      // положение ползунка
      thumb.style.left = ratio * 100 + '%';
      thumb.style.color = hex;

      thumbFill.style.background = hex;
      previewBubble.style.background = hex;

      // Событие всплывает до document — слушай его откуда угодно на странице
      slider.dispatchEvent(
        new CustomEvent('colorchange', {
          bubbles: true,
          detail: { target: targetName, color },
        })
      );
    }

    // Пользователь нажал мышкой в координате X.
    // Насколько это место далеко от левого края слайдера?
    function ratioFromClientX(clientX) {
      const rect = slider.getBoundingClientRect();
      let ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(1, ratio));
    }

    // стартовое значение — берём из data-hue в HTML
    // и применяем к элементам через appleHue
    const initialHue = parseFloat(slider.dataset.hue);
    applyHue(initialHue, initialHue / 360);

    // пользователь сейчас тащит ползунок?
    let active = false;

    function down(e) {
      active = true;
      thumb.classList.add('active');
      if (isTouchDevice && previewBubble)
        previewBubble.classList.add('visible');
      const ratio = ratioFromClientX(
        e.touches ? e.touches[0].clientX : e.clientX
      );
      applyHue(ratio * 360, ratio);
      e.preventDefault();
    }
    function move(e) {
      if (!active) return;
      const ratio = ratioFromClientX(
        e.touches ? e.touches[0].clientX : e.clientX
      );
      applyHue(ratio * 360, ratio);
      e.preventDefault();
    }
    function up() {
      if (!active) return;
      active = false;
      thumb.classList.remove('active');
      if (previewBubble) previewBubble.classList.remove('visible');
    }

    slider.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    slider.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
  }

  // ---------- 3b. Любой .range-slider на странице становится линейным value picker'ом ----------
  // Та же механика драга, что и у .hue-slider, но диапазон задаётся
  // числами (data-min / data-max), а не оттенком.
  // Панель-обёртка должна иметь data-value-target — имя, под которым
  // значение придёт в событии valuechange (аналог colorchange у hue-slider).
  function initRangeSlider(slider) {
    const panel = slider.closest('.panel');
    const targetName = panel.dataset.valueTarget;
    const min = parseFloat(slider.dataset.min ?? '0');
    const max = parseFloat(slider.dataset.max ?? '1');
    const thumb = slider.querySelector('.thumb');
    const thumbFill = slider.querySelector('.thumb-fill');
    const previewBubble = slider.querySelector('.preview-bubble');
    const valueLabel = slider.querySelector('.value-label');

    function applyValue(ratio) {
      ratio = Math.max(0, Math.min(1, ratio));
      const value = min + ratio * (max - min);

      thumb.style.left = ratio * 100 + '%';
      if (thumbFill) thumbFill.style.width = ratio * 100 + '%';
      if (valueLabel) valueLabel.textContent = value.toFixed(2) + 'x';
      if (previewBubble) previewBubble.textContent = value.toFixed(2) + 'x';

      slider.dispatchEvent(
        new CustomEvent('valuechange', {
          bubbles: true,
          detail: { target: targetName, value },
        })
      );
    }

    function ratioFromClientX(clientX) {
      const rect = slider.getBoundingClientRect();
      return (clientX - rect.left) / rect.width;
    }

    // стартовое значение — data-value на слайдере (по умолчанию середина диапазона)
    const initialValue = parseFloat(slider.dataset.value ?? (min + max) / 2);
    applyValue((initialValue - min) / (max - min));

    let active = false;

    function down(e) {
      active = true;
      thumb.classList.add('active');
      if (isTouchDevice && previewBubble)
        previewBubble.classList.add('visible');
      applyValue(
        ratioFromClientX(e.touches ? e.touches[0].clientX : e.clientX)
      );
      e.preventDefault();
    }
    function move(e) {
      if (!active) return;
      applyValue(
        ratioFromClientX(e.touches ? e.touches[0].clientX : e.clientX)
      );
      e.preventDefault();
    }
    function up() {
      if (!active) return;
      active = false;
      thumb.classList.remove('active');
      if (previewBubble) previewBubble.classList.remove('visible');
    }

    slider.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    slider.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
  }

  function initIconSelect(group) {
    const targetName = group.dataset.optionTarget;
    const buttons = Array.from(group.querySelectorAll('.icon-btn'));

    function select(btn) {
      buttons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');

      const value = btn.dataset.value;

      // Событие всплывает до document — слушай его откуда угодно на странице,
      // так же как colorchange у hue-slider'а
      group.dispatchEvent(
        new CustomEvent('optionchange', {
          bubbles: true,
          detail: { target: targetName, value },
        })
      );
    }

    // предвыбор варианта, если задан data-default на группе
    const defaultValue = group.dataset.default;
    if (defaultValue) {
      const defaultBtn = buttons.find((b) => b.dataset.value === defaultValue);
      select(defaultBtn);
    }

    function playPressAnimation(btn) {
      const svg = btn.querySelector('.icon-btn-svg');

      svg.classList.remove('pressed');
      void svg.offsetWidth; // форсируем reflow, чтобы анимация могла перезапуститься
      // даже при быстрых повторных кликах по той же иконке
      svg.classList.add('pressed');
      svg.addEventListener(
        'animationend',
        () => svg.classList.remove('pressed'),
        { once: true }
      );
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        select(btn);
        playPressAnimation(btn);
      });
    });
  }

  // ---------- Инициализация: находим всё нужное на странице и подключаем ----------
  document.querySelectorAll('.panel').forEach((panel) => {
    initDrag(panel);
    initClose(panel);
  });
  document.querySelectorAll('.hue-slider').forEach(initHueSlider);
  document.querySelectorAll('.range-slider').forEach(initRangeSlider);
  document.querySelectorAll('.icon-select').forEach(initIconSelect);

  /* =============================================================================
   ИСПОЛЬЗОВАНИЕ ЦВЕТОВ ГДЕ УГОДНО НА СТРАНИЦЕ
   Не нужно трогать код выше — просто слушаем событие colorchange
   и фильтруем по e.detail.target.
   ============================================================================= */
  document.addEventListener('colorchange', (e) => {
    const { target, color } = e.detail;
    // сохраняем новый цвет (цвет чего? за это отвечает target) в глобальной переменной beetleOptions
    // оттуда уже через Proxy выполнится функция onBeetleOptionsChange
    beetleOptions[target] = color.hex;
  });

  // Так же слушаем optionchange от icon-select панелей.
  // В реальном проекте вместо demo-свотча тут будет что-то вроде:
  //   beetleOptions.eyeShape.selected = value;
  document.addEventListener('optionchange', (e) => {
    console.log('Случилось событие optionchange');
    const { target, value } = e.detail;
    beetleOptions[target] = value;
  });
});
