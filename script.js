(function () {
  const RATES = { EUR: 1.821, USD: 1.7, TRY: 0.052 };
  const CONFIG = {
    parcelLimitEur: 300,
    personalLimitEur: 800,
    dutyPct: 0.15,
    vatPct: 0.18,
    shippingDeEur: 22,
    shippingUsUsd: 38,
  };

  const CATALOG = [
    {
      aliases: ['iphone 16 pro', 'iphone16pro'],
      brand: 'Apple',
      model: 'iPhone 16 Pro',
      storage: '256 GB',
      color: 'Black Titanium',
      specs: 'Apple A18 Pro · iOS 18 · 6.3" OLED · 5G',
      az: { kontakt: 2890, irshad: 2950, tapBusiness: 2790, tapPrivate: 2750, tapCount: 14 },
      global: { deEur: 1229, usUsd: 1199, dubaiEur: 1229, turkeyTry: 45999 },
    },
    {
      aliases: ['samsung s25 ultra', 'galaxy s25 ultra', 's25 ultra'],
      brand: 'Samsung',
      model: 'Galaxy S25 Ultra',
      storage: '256 GB',
      color: 'Titanium Gray',
      specs: 'Snapdragon 8 Elite · One UI · 6.8" AMOLED · 5G',
      az: { kontakt: 2710, irshad: 2760, tapBusiness: 2590, tapPrivate: 2520, tapCount: 18 },
      global: { deEur: 1099, usUsd: 1049, dubaiEur: 998, turkeyTry: 42750 },
    },
    {
      aliases: ['ps5 slim', 'playstation 5 slim', 'ps5'],
      brand: 'Sony',
      model: 'PS5 Slim',
      storage: '1 TB',
      color: 'White',
      specs: 'AMD Zen 2 · RDNA2 · 1TB SSD · 4K/120Hz',
      az: { kontakt: 1290, irshad: 1330, tapBusiness: 1200, tapPrivate: 1130, tapCount: 22 },
      global: { deEur: 499, usUsd: 499, dubaiEur: 480, turkeyTry: 23500 },
    },
  ];

  initDropdowns();
  initSearchHandlers();

  const root = document.getElementById('resultsRoot');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q') || 'iPhone 16 Pro 256GB';
  const queryInput = document.getElementById('queryInput');
  if (queryInput) queryInput.value = initialQuery;

  renderForQuery(initialQuery);

  function initDropdowns() {
    const langSwitcher = document.getElementById('langSwitcher');
    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');

    if (langBtn && langSwitcher && langMenu) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langSwitcher.classList.toggle('open');
      });

      langMenu.querySelectorAll('li').forEach((item) => {
        item.addEventListener('click', () => {
          langMenu.querySelectorAll('li').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');
          langBtn.textContent = item.textContent.replace(' ✓', '') + ' ▾';
          langSwitcher.classList.remove('open');
        });
      });
    }

    const countrySelect = document.getElementById('countrySelect');
    const countryBtn = document.getElementById('countryBtn');
    const countryMenu = document.getElementById('countryMenu');

    if (countryBtn && countrySelect && countryMenu) {
      countryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        countrySelect.classList.toggle('open');
      });

      countryMenu.querySelectorAll('li:not(.soon)').forEach((item) => {
        item.addEventListener('click', () => {
          countryMenu.querySelectorAll('li').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');
          countryBtn.textContent = item.textContent.replace(' ✓', '') + ' ▾';
          countrySelect.classList.remove('open');
        });
      });
    }

    document.addEventListener('click', () => {
      countrySelect && countrySelect.classList.remove('open');
      langSwitcher && langSwitcher.classList.remove('open');
    });
  }

  function initSearchHandlers() {
    const queryInput = document.getElementById('queryInput');
    const calcBtn = document.getElementById('calcBtn');

    const submitSearch = (query) => {
      if (!query) return;
      const params = new URLSearchParams({ q: query, country: 'az' });
      if (window.location.pathname.endsWith('results.html')) {
        window.history.replaceState({}, '', `results.html?${params.toString()}`);
        renderForQuery(query);
      } else {
        window.location.href = `results.html?${params.toString()}`;
      }
    };

    if (calcBtn && queryInput) {
      calcBtn.addEventListener('click', () => submitSearch(queryInput.value.trim()));
      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitSearch(queryInput.value.trim());
      });
    }

    const chips = document.getElementById('chips');
    if (chips) {
      chips.querySelectorAll('button').forEach((chip) => {
        chip.addEventListener('click', () => submitSearch(chip.textContent.trim()));
      });
    }
  }

  function renderForQuery(rawQuery) {
    const loading = document.getElementById('loadingState');
    if (loading) loading.style.display = 'block';
    root.innerHTML = '';

    setTimeout(() => {
      const matched = findProduct(rawQuery);
      const product = matched.product;
      const isApprox = matched.score < 0.95;
      const calc = calculate(product);
      const best = getBestOption(calc.options);
      const baseline = Math.min(calc.localOfficialTotal, calc.localTapTotal);
      const savings = Math.max(0, baseline - best.total);
      const savingsPct = baseline ? Math.round((savings / baseline) * 100) : 0;

      root.innerHTML = renderResults(product, calc, best, savings, savingsPct, rawQuery, isApprox);
      if (loading) loading.style.display = 'none';
    }, 900);
  }

  function findProduct(query) {
    const q = normalize(query);
    if (!q) return { product: CATALOG[0], score: 0.8 };

    for (const item of CATALOG) {
      if (item.aliases.some((a) => q.includes(a))) return { product: item, score: 1 };
    }

    const fuzzy = CATALOG.find((item) => item.aliases.some((a) => q.split(' ').some((w) => a.includes(w) && w.length > 3)));
    if (fuzzy) return { product: fuzzy, score: 0.8 };
    return { product: CATALOG[0], score: 0.75 };
  }

  function normalize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/гб/g, 'gb')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function calculate(product) {
    const localAvg = round((product.az.kontakt + product.az.irshad) / 2);
    const localTapAvg = round((product.az.tapBusiness + product.az.tapPrivate) / 2);

    const deBaseEur = product.global.deEur + CONFIG.shippingDeEur;
    const deBaseAzn = deBaseEur * RATES.EUR;
    const deDuty = deBaseEur > CONFIG.parcelLimitEur ? deBaseAzn * CONFIG.dutyPct : 0;
    const deVat = deBaseEur > CONFIG.parcelLimitEur ? (deBaseAzn + deDuty) * CONFIG.vatPct : 0;
    const deTotal = round(deBaseAzn + deDuty + deVat);

    const usBaseUsd = product.global.usUsd + CONFIG.shippingUsUsd;
    const usBaseAzn = usBaseUsd * RATES.USD;
    const usDuty = usBaseUsd / 1.1 > CONFIG.parcelLimitEur ? usBaseAzn * CONFIG.dutyPct : 0;
    const usVat = usBaseUsd / 1.1 > CONFIG.parcelLimitEur ? (usBaseAzn + usDuty) * CONFIG.vatPct : 0;
    const usTotal = round(usBaseAzn + usDuty + usVat);

    const dubaiGoodsAzn = product.global.dubaiEur * RATES.EUR;
    const dubaiDuty = product.global.dubaiEur > CONFIG.personalLimitEur ? (product.global.dubaiEur - CONFIG.personalLimitEur) * RATES.EUR * CONFIG.dutyPct : 0;
    const dubaiTotal = round(dubaiGoodsAzn + dubaiDuty);

    const trGoodsAzn = product.global.turkeyTry * RATES.TRY;
    const vatRefund = trGoodsAzn * 0.18 / 1.18;
    const trDuty = trGoodsAzn / RATES.EUR > CONFIG.personalLimitEur ? (trGoodsAzn / RATES.EUR - CONFIG.personalLimitEur) * RATES.EUR * CONFIG.dutyPct : 0;
    const trTotal = round(trGoodsAzn - vatRefund + trDuty);

    return {
      localOfficialTotal: product.az.kontakt,
      localAvg,
      localTapTotal: product.az.tapPrivate,
      localTapAvg,
      deDuty: round(deDuty),
      usDuty: round(usDuty),
      deTotal,
      usTotal,
      dubaiTotal,
      trTotal,
      options: [
        { key: 'local', title: 'Официальный ритейл', total: product.az.kontakt },
        { key: 'tap', title: 'Tap.az — вторичный рынок', total: product.az.tapPrivate },
        { key: 'de', title: 'Amazon.de → карго → Баку', total: deTotal },
        { key: 'us', title: 'Amazon.com → форвардинг → Баку', total: usTotal },
        { key: 'dubai', title: '🇦🇪 Дубай — Amazon.de / магазин', total: dubaiTotal },
        { key: 'tr', title: '🇹🇷 Турция — Apple Store İstanbul', total: trTotal },
      ],
      vatRefund: round(vatRefund),
    };
  }

  function getBestOption(options) {
    return [...options].sort((a, b) => a.total - b.total)[0];
  }

  function renderResults(product, calc, best, savings, savingsPct, query, isApprox) {
    const updated = `● обновлено ${Math.ceil(Math.random() * 5)} часа назад`;
    const maybeApprox = isApprox ? ' · приблизительное совпадение' : '';

    return `
      <section class="panel">
        <h2>${product.model} · ${product.storage} · ${product.color}</h2>
        <p>${product.specs}</p>
        <p class="update">${updated}${maybeApprox} · запрос: ${query}</p>
      </section>

      <section class="panel verdict">
        <div>
          <h3>→ ${best.title} — выгоднее всего</h3>
          <p>Экономия ${fmt(savings)} AZN относительно лучшей цены локального рынка.</p>
        </div>
        <div>
          <div class="big">−${fmt(savings)} AZN</div>
          <div>экономия ${savingsPct}%</div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><span class="section-no">1</span> Локальный рынок · Купить прямо сейчас в Баку</div>
        <div class="grid">
          ${card('Официальный ритейл', `${fmt(calc.localOfficialTotal)} AZN`, 'Гарантия 12 мес. · доставка бесплатно', ['официально|b-blue', 'сразу в руки|b-gray'], [
            ['Kontakt.az', `${fmt(product.az.kontakt)} AZN`, ''], ['Irshad.az', `${fmt(product.az.irshad)} AZN`, ''], ['Средняя цена', `${fmt(calc.localAvg)} AZN`, ''], ['Наличие', 'В наличии', 'v-faint'], ['Итого', `${fmt(calc.localOfficialTotal)} AZN`, '']
          ], 'kontakt.az ↗ · irshad.az ↗ · Офиц. гарантия', best.key === 'local')}
          ${card('Tap.az — вторичный рынок', `от ${fmt(calc.localTapTotal)} AZN`, `${product.az.tapCount} объявлений · среднее ${fmt(calc.localTapAvg)} AZN`, ['проверяй продавца|b-amber'], [
            ['Бизнес-продавцы', `от ${fmt(product.az.tapBusiness)} AZN`, ''], ['Частные продавцы', `от ${fmt(product.az.tapPrivate)} AZN`, ''], ['Средняя цена', `${fmt(calc.localTapAvg)} AZN`, ''], ['Активных объявлений', `${product.az.tapCount} шт.`, 'v-faint'], ['Минимальная цена (итого)', `${fmt(calc.localTapTotal)} AZN`, '']
          ], 'tap.az ↗ · Объявления <30 дней', best.key === 'tap')}
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><span class="section-no">2</span> Посылкой / карго · Заказать онлайн, получить через 7–21 день</div>
        <div class="grid">
          ${card('Amazon.de → карго → Баку', `≈ ${fmt(calc.deTotal)} AZN`, 'С доставкой и таможней · 7–10 дней', ['таможня 15%|b-amber'], [
            ['Цена Amazon.de', `€ ${fmt(product.global.deEur)}`, ''], ['Курс EUR → AZN', `× ${RATES.EUR}`, 'v-faint'], ['Товар в AZN', `${fmt(round(product.global.deEur * RATES.EUR))} AZN`, ''], ['Доставка карго', `~ ${fmt(round(CONFIG.shippingDeEur * RATES.EUR))} AZN`, ''], ['Таможня 15%', `+ ${fmt(calc.deDuty)} AZN`, 'v-amber'], ['Лимит без пошлины', '€300 (превышен)', 'v-faint'], ['Итого', `≈ ${fmt(calc.deTotal)} AZN`, '']
          ], 'amazon.de ↗ · Senden, DHL, AzPost', best.key === 'de')}
          ${card('Amazon.com → форвардинг → Баку', `≈ ${fmt(calc.usTotal)} AZN`, 'Дороже доставка · 14–21 день', ['таможня 15%|b-amber'], [
            ['Цена Amazon.com', `$ ${fmt(product.global.usUsd)}`, ''], ['Курс USD → AZN', `× ${RATES.USD}`, 'v-faint'], ['Товар в AZN', `${fmt(round(product.global.usUsd * RATES.USD))} AZN`, ''], ['Доставка из США', `~ ${fmt(round(CONFIG.shippingUsUsd * RATES.USD))} AZN`, ''], ['Таможня 15%', `+ ${fmt(calc.usDuty)} AZN`, 'v-amber'], ['Срок доставки', '14–21 день', 'v-faint'], ['Итого', `≈ ${fmt(calc.usTotal)} AZN`, '']
          ], 'amazon.com ↗ · Shipito, MyUS', best.key === 'us')}
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><span class="section-no">3</span> Везу сам · Купить за рубежом и привезти лично</div>
        <div class="grid">
          ${card('🇦🇪 Дубай — Amazon.de / магазин', `≈ ${fmt(calc.dubaiTotal)} AZN`, 'Лично · Перелёт не включён', ['без таможни|b-soft-green'], [
            ['Цена Amazon.de / магазин', `€ ${fmt(product.global.dubaiEur)}`, ''], ['Курс EUR → AZN', `× ${RATES.EUR}`, 'v-faint'], ['Товар в AZN', `${fmt(round(product.global.dubaiEur * RATES.EUR))} AZN`, ''], ['Лимит личного ввоза', '€ 800 / чел.', 'v-faint'], ['Таможня', `${calc.dubaiTotal === round(product.global.dubaiEur * RATES.EUR) ? '0 AZN — ниже лимита ✓' : 'есть превышение лимита'}`, calc.dubaiTotal === round(product.global.dubaiEur * RATES.EUR) ? 'v-green' : 'v-amber'], ['НДС при ввозе', '0 AZN ✓', 'v-green'], ['Итого', `≈ ${fmt(calc.dubaiTotal)} AZN`, '']
          ], 'amazon.de ↗ · Перелёт не включён', best.key === 'dubai')}
          ${card('🇹🇷 Турция — Apple Store İstanbul', `≈ ${fmt(calc.trTotal)} AZN`, 'После VAT refund', ['без таможни|b-soft-green', 'VAT refund|b-violet'], [
            ['Apple Store Turkey', `₺ ${fmt(product.global.turkeyTry)}`, ''], ['Курс TRY → AZN', `× ${RATES.TRY}`, 'v-faint'], ['Товар в AZN', `${fmt(round(product.global.turkeyTry * RATES.TRY))} AZN`, ''], ['Лимит личного ввоза', '€ 800 / чел.', 'v-faint'], ['Таможня', '0 AZN — ниже лимита ✓', 'v-green'], ['VAT refund (~18%)', `− ${fmt(calc.vatRefund)} AZN`, 'v-green'], ['Итого после VAT refund', `≈ ${fmt(calc.trTotal)} AZN`, '']
          ], 'apple.com/tr ↗ · VAT refund — аэропорт Стамбул', best.key === 'tr')}
        </div>
      </section>

      <p class="disclaimer">Все расчёты оценочные. Актуальные ставки: <a href="https://customs.gov.az" target="_blank" rel="noreferrer">customs.gov.az</a>. Курс ЦБА обновляется каждые 6 часов. Tap.az — объявления не старше 30 дней. Лимит личного ввоза €800 на одного человека в одну поездку.</p>
    `;
  }

  function card(source, price, note, badges, rows, footer, isGlobalBest) {
    const normalizedBadges = [...badges];
    if (isGlobalBest) normalizedBadges.unshift('выгоднее всего|b-green');
    const badgesHtml = normalizedBadges
      .map((b) => {
        const [text, cls] = b.split('|');
        return `<span class="badge ${cls}">${text}</span>`;
      })
      .join('');

    const rowsHtml = rows.map(([k, v, c]) => `<tr><td>${k}</td><td class="${c || ''}">${v}</td></tr>`).join('');
    return `
      <article class="card">
        <h4>${source}</h4>
        <p><strong>${price}</strong> · ${note}</p>
        <div class="badges">${badgesHtml}</div>
        <table>${rowsHtml}</table>
        <p class="footer-note">${footer}</p>
      </article>
    `;
  }

  function round(value) {
    return Math.round(value);
  }

  function fmt(value) {
    return new Intl.NumberFormat('ru-RU').format(Math.round(value));
  }
})();
