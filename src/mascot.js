document.addEventListener('DOMContentLoaded', () => {
  const widget = document.querySelector('.mascot-widget');

  // #region Анимация маскота
  const face = document.querySelector('.mascot-face');

  // Насколько сильно наклоняется лицо (в градусах) и насколько
  // далеко от маскота курсор должен быть, чтобы наклон стал максимальным.
  const MAX_TILT = 30; // deg
  const X_RANGE = 420; // px
  const Y_RANGE = 100; // px
  const X_SLIDE = 20; // px — насколько "лицо" сдвигается по сфере
  const Y_SLIDE = 30; // px — насколько "лицо" сдвигается по сфере
  const SMOOTHING = 0.08; // 0..1, чем меньше — тем медленнее и плавнее следование

  // target — куда лицо должно стремиться, current — где оно сейчас (лерп)
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };

  function onPointerMove(e) {
    const rect = widget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = (e.clientX - cx) / X_RANGE;
    let dy = (e.clientY - cy) / Y_RANGE;

    // ограничиваем диапазон -1..1, чтобы наклон не был запредельным
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    target.x = dx;
    target.y = dy;
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });

  function animate() {
    // линейная интерполяция current -> target даёт эффект "инерции"/задержки
    current.x += (target.x - current.x) * SMOOTHING;
    current.y += (target.y - current.y) * SMOOTHING;

    const rotY = current.x * MAX_TILT; // курсор правее -> поворот вокруг Y
    const rotX = -current.y * MAX_TILT; // курсор выше   -> поворот вокруг X
    const moveX = current.x * X_SLIDE;
    const moveY = current.y * Y_SLIDE * 0.7;

    face.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translate(${moveX}px, ${moveY}px)`;

    requestAnimationFrame(animate);
  }

  animate();
  // #endregion Анимация маскота

  let messageEl = widget.querySelector('.mascot-message');
  let messageTextEl = messageEl.querySelector('span');
  let hideTimer = null;
  // счётчик появлений сообщения, индекс сообщения, которое показали последним
  let counter = new WeakMap();

  function parseMessages(el) {
    let raw = el.dataset.mascotMessages || el.dataset.mascotMessage || '';
    let result = raw
      .split('|')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    return result;
  }

  function showMessage(text, durationSec) {
    clearTimeout(hideTimer);
    messageTextEl.textContent = text;
    messageEl.classList.add('is-visible');
    hideTimer = setTimeout(function () {
      messageEl.classList.remove('is-visible');
    }, durationSec * 1000);
  }

  function trigger(el) {
    let elCount = counter.get(el);
    if (!elCount) {
      // ещё не показали ни одного сообщения --
      // индекс последнего показаного сообщения -1
      elCount = { count: 0, lastIndex: -1 };
      counter.set(el, elCount);
    }

    // если ли ограничение на количество показов сообщений?
    let limit = Infinity;
    if (el.dataset.mascotLimit !== undefined) {
      limit = parseInt(el.dataset.mascotLimit, 10);
    }
    if (elCount.count >= limit) return;

    // вероятность поляления
    let chance = 1;
    if (el.dataset.mascotChance !== undefined) {
      chance = parseFloat(el.dataset.mascotChance);
    }
    if (Math.random() > chance) return;

    let messages = parseMessages(el);
    if (!messages.length) return;

    let index = 0;
    if (messages.length > 1) {
      do {
        index = Math.floor(Math.random() * messages.length);
      } while (index === elCount.lastIndex);
    }
    elCount.lastIndex = index;
    elCount.count += 1;

    // ДЛИТЕЛЬНОСТЬ
    // по умолчанию 3 секунды
    let duration =
      el.dataset.mascotDuration !== undefined
        ? parseFloat(el.dataset.mascotDuration)
        : 2;

    showMessage(messages[index], duration);
  }

  let elements = document.querySelectorAll(
    '[data-mascot-message], [data-mascot-messages]'
  );
  elements.forEach(function (el) {
    let eventType = el.dataset.mascotEvent || 'hover';
    if (eventType === 'hover' || eventType === 'both') {
      el.addEventListener('mouseenter', function () {
        trigger(el);
      });
    }
    if (eventType === 'click' || eventType === 'both') {
      el.addEventListener('click', function () {
        trigger(el);
      });
    }
  });
});
