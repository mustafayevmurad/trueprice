(async function () {
  const isResults = Boolean(document.getElementById('resultsRoot'));
  const chipsRoot = document.getElementById('chips');
  const countryMenu = document.getElementById('countryMenu');
  const countryBtn = document.getElementById('countryBtn');
  const countrySelect = document.getElementById('countrySelect');
  const queryInput = document.getElementById('queryInput');
  const calcBtn = document.getElementById('calcBtn');

  let config;
  try {
    const res = await fetch('/api/admin/config', { headers: { 'x-admin-password': 'public-preview' } });
    if (!res.ok) throw new Error('fallback');
    config = await res.json();
  } catch {
    config = await (await fetch('/api/rates')).json().then((x) => ({ rates: x.rates }));
    const localStore = await fetch('/api/search?q=iPhone%2016%20Pro&country=az').then((r) => r.json());
    config.countries = [{ code: 'az', flag: '🇦🇿', name_ru: 'Азербайджан', city: 'Баку', currency: 'AZN', status: 'active' }];
    config.chips = ['iPhone 16 Pro', 'Samsung S25 Ultra', 'PS5 Slim'];
    config.rates = localStore.rates;
  }

  renderCountries(config.countries || []);
  if (chipsRoot) renderChips(config.chips || []);

  countryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    countrySelect.classList.toggle('open');
  });
  document.addEventListener('click', () => countrySelect.classList.remove('open'));

  const submit = () => {
    const q = queryInput.value.trim();
    const country = countryBtn.dataset.code || 'az';
    if (!q) return;
    if (isResults) runSearch(q, country);
    else window.location.href = `/results.html?q=${encodeURIComponent(q)}&country=${country}`;
  };

  calcBtn.addEventListener('click', submit);
  queryInput.addEventListener('keydown', (e) => e.key === 'Enter' && submit());

  if (isResults) {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || 'iPhone 16 Pro 256GB';
    const country = params.get('country') || 'az';
    queryInput.value = q;
    runSearch(q, country);
  }

  async function runSearch(q, country) {
    const loading = document.getElementById('loadingState');
    const root = document.getElementById('resultsRoot');
    loading.style.display = 'block';
    root.innerHTML = '';
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&country=${country}`);
    const data = await res.json();
    loading.style.display = 'none';
    if (!res.ok) {
      root.innerHTML = `<section class="panel"><h3>Ошибка</h3><p>${data.error}</p></section>`;
      return;
    }
    history.replaceState({}, '', `/results.html?q=${encodeURIComponent(q)}&country=${country}`);
    root.innerHTML = renderResults(data, q);
  }

  function renderCountries(countries) {
    const active = countries.filter((c) => c.status === 'active')[0] || countries[0];
    if (active) {
      countryBtn.textContent = `${active.flag} ${active.name_ru} · ${active.city} · ${active.currency} ▾`;
      countryBtn.dataset.code = active.code;
    }
    countryMenu.innerHTML = countries
      .map((c) => `<li class="${c.status === 'soon' ? 'soon' : ''}" data-code="${c.code}">${c.flag} ${c.name_ru} · ${c.city} · ${c.currency}${c.status === 'soon' ? ' <span>скоро</span>' : ''}</li>`)
      .join('');
    countryMenu.querySelectorAll('li:not(.soon)').forEach((li) => li.addEventListener('click', () => {
      countryBtn.dataset.code = li.dataset.code;
      countryBtn.textContent = `${li.textContent.replace(' ✓', '').trim()} ▾`;
      countrySelect.classList.remove('open');
    }));
  }

  function renderChips(chips) {
    chipsRoot.innerHTML = chips.map((c) => `<button>${c}</button>`).join('');
    chipsRoot.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      queryInput.value = b.textContent;
      window.location.href = `/results.html?q=${encodeURIComponent(b.textContent)}&country=${countryBtn.dataset.code || 'az'}`;
    }));
  }

  function fmt(v) { return new Intl.NumberFormat('ru-RU').format(Math.round(v)); }

  function renderResults(data, query) {
    const p = data.product;
    const v = data.verdict;
    const s = data.sections;
    const r = data.rates;
    const best = v.best_key;
    return `
      <section class="panel">
        <h2>${p.display_name}</h2>
        <p>${p.specs}</p>
        <p class="update">● обновлено ${new Date(p.updated_at).toLocaleString('ru-RU')} · запрос: ${query}${data.match.approximate ? ' · приблизительное совпадение' : ''}</p>
      </section>
      <section class="panel verdict"><div><h3>${v.text}</h3><p>${v.sub_text}</p></div><div><div class="big">−${fmt(v.savings_azn)} AZN</div><div>экономия ${v.savings_pct}%</div></div></section>

      <section class="panel"><div class="section-title"><span class="section-no">1</span> Локальный рынок</div><div class="grid">
        ${card('Официальный ритейл', `${fmt(s.local.official.total)} AZN`, ['официально|b-blue','сразу в руки|b-gray'], [['Kontakt.az',`${fmt(s.local.official.kontakt)} AZN`,''],['Irshad.az',`${fmt(s.local.official.irshad)} AZN`,''],['Средняя цена',`${fmt(s.local.official.avg)} AZN`,''],['Итого',`${fmt(s.local.official.total)} AZN`,'']], best==='local')}
        ${card('Tap.az — вторичный рынок', `от ${fmt(s.local.tap.total)} AZN`, ['проверяй продавца|b-amber'], [['Бизнес-продавцы',`от ${fmt(s.local.tap.business)} AZN`,''],['Частные продавцы',`от ${fmt(s.local.tap.private)} AZN`,''],['Средняя цена',`${fmt(s.local.tap.avg)} AZN`,''],['Активных объявлений',`${s.local.tap.count} шт.`,'v-faint'],['Минимальная цена',`${fmt(s.local.tap.total)} AZN`,'']], best==='tap')}
      </div></section>

      <section class="panel"><div class="section-title"><span class="section-no">2</span> Посылкой / карго</div><div class="grid">
        ${card('Amazon.de → карго → Баку', `≈ ${fmt(s.parcel.de.total)} AZN`, ['таможня 15%|b-amber'], [['Цена Amazon.de',`€ ${fmt(s.parcel.de.price_eur)}`,''],['Курс EUR → AZN',`× ${r.EUR}`,'v-faint'],['Доставка',`~ ${fmt(s.parcel.de.delivery_azn)} AZN`,''],['Таможня+НДС',`+ ${fmt(s.parcel.de.duty_azn)} AZN`,'v-amber'],['Итого',`≈ ${fmt(s.parcel.de.total)} AZN`,'']], best==='de')}
        ${card('Amazon.com → форвардинг → Баку', `≈ ${fmt(s.parcel.us.total)} AZN`, ['таможня 15%|b-amber'], [['Цена Amazon.com',`$ ${fmt(s.parcel.us.price_usd)}`,''],['Курс USD → AZN',`× ${r.USD}`,'v-faint'],['Доставка',`~ ${fmt(s.parcel.us.delivery_azn)} AZN`,''],['Таможня+НДС',`+ ${fmt(s.parcel.us.duty_azn)} AZN`,'v-amber'],['Итого',`≈ ${fmt(s.parcel.us.total)} AZN`,'']], best==='us')}
      </div></section>

      <section class="panel"><div class="section-title"><span class="section-no">3</span> Везу сам</div><div class="grid">
        ${card('🇦🇪 Дубай', `≈ ${fmt(s.carry.dubai.total)} AZN`, ['без таможни|b-soft-green'], [['Цена',`€ ${fmt(s.carry.dubai.price_eur)}`,''],['Курс EUR → AZN',`× ${r.EUR}`,'v-faint'],['Итого',`≈ ${fmt(s.carry.dubai.total)} AZN`,'']], best==='dubai')}
        ${card('🇹🇷 Турция', `≈ ${fmt(s.carry.turkey.total)} AZN`, ['VAT refund|b-violet','без таможни|b-soft-green'], [['Цена',`₺ ${fmt(s.carry.turkey.price_try)}`,''],['Курс TRY → AZN',`× ${r.TRY}`,'v-faint'],['VAT refund',`− ${fmt(s.carry.turkey.vat_refund_azn)} AZN`,'v-green'],['Итого',`≈ ${fmt(s.carry.turkey.total)} AZN`,'']], best==='tr')}
      </div></section>
      <p class="disclaimer">Все расчёты оценочные. Актуальные ставки: <a href="https://customs.gov.az" target="_blank">customs.gov.az</a>.</p>
    `;
  }

  function card(title, price, badges, rows, best) {
    const allBadges = best ? ['выгоднее всего|b-green', ...badges] : badges;
    return `<article class="card"><h4>${title}</h4><p><strong>${price}</strong></p><div class="badges">${allBadges.map((b) => { const [t,c]=b.split('|'); return `<span class="badge ${c}">${t}</span>`; }).join('')}</div><table>${rows.map((r)=>`<tr><td>${r[0]}</td><td class="${r[2]||''}">${r[1]}</td></tr>`).join('')}</table></article>`;
  }
})();
