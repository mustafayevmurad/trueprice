(function () {
  const loginBtn = document.getElementById('loginBtn');
  const passInput = document.getElementById('adminPassword');
  const panel = document.getElementById('adminPanel');
  let password = '';

  loginBtn.addEventListener('click', async () => {
    password = passInput.value.trim();
    if (!password) return;
    const res = await fetch('/api/admin/config', { headers: { 'x-admin-password': password } });
    if (!res.ok) return alert('Неверный пароль');
    const cfg = await res.json();
    panel.style.display = 'block';
    document.getElementById('chipsInput').value = JSON.stringify(cfg.chips, null, 2);
    document.getElementById('countriesInput').value = JSON.stringify(cfg.countries, null, 2);
    document.getElementById('customsInput').value = JSON.stringify(cfg.customs, null, 2);
    document.getElementById('deliveryInput').value = JSON.stringify(cfg.delivery, null, 2);
    document.getElementById('skuInput').value = JSON.stringify(cfg.products, null, 2);
  });

  panel.addEventListener('click', async (e) => {
    const key = e.target.dataset.save;
    if (!key) return;

    try {
      let body = {};
      if (key === 'chips') {
        const chips = JSON.parse(document.getElementById('chipsInput').value);
        if (chips.length > 10) return alert('Максимум 10 chips');
        body = { chips };
      }
      if (key === 'countries') body = { countries: JSON.parse(document.getElementById('countriesInput').value) };
      if (key === 'customs') body = { customs: JSON.parse(document.getElementById('customsInput').value) };
      if (key === 'delivery') body = { delivery: JSON.parse(document.getElementById('deliveryInput').value) };
      if (key === 'sku') body = { products: JSON.parse(document.getElementById('skuInput').value) };

      const res = await fetch(`/api/admin/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(body),
      });
      if (!res.ok) return alert('Ошибка сохранения');
      alert('Сохранено');
    } catch {
      alert('Некорректный JSON');
    }
  });
})();
