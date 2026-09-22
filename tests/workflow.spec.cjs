const { test, expect } = require('@playwright/test');

test.use({ launchOptions: { channel: 'msedge' }, viewport: { width: 1440, height: 1000 } });
test.setTimeout(180000);

test('login, impersonating, BPMP CRUD, issue/cancel, BP21, BPA2, linked SPT and payment', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/login');
  await page.locator('#userId').fill('edutax');
  await page.locator('#password').fill('edutax2026');
  await expect(page.locator('output')).not.toHaveText('');
  await page.locator('#captcha').fill((await page.locator('output').innerText()).trim());
  await page.getByRole('button',{name:'Login',exact:true}).click();
  await page.waitForURL('**/portal');
  await page.getByRole('button',{name:/3271022601770007 RAKA/}).click();
  await page.getByRole('button',{name:/0012345678910000 PT KARYA MANDIRI SEJAHTERA/}).click();
  await expect(page.getByText(/You are currently impersonating user/)).toBeVisible();
  const readDb=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('edutax.uny.v1.db')));
  async function sign() {
    await page.getByRole('button',{name:'Terbitkan',exact:true}).click();
    await page.locator('#sd-pass').fill('simulasi');
    await page.getByRole('button',{name:'Konfirmasi Tanda Tangan'}).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
  await page.goto('http://localhost:3000/ebupot/bpmp');
  await page.getByRole('button',{name:'+ Buat eBupot MP',exact:true}).click();
  await page.locator('#p').selectOption('K/0');await page.locator('#m').selectOption('9'); await page.locator('#y').fill('2024');
  await page.locator('#n').fill('3217122601770007'); await expect(page.locator('#nm2')).toHaveValue('RAKA');
  await page.getByLabel('Tax Object Name',{exact:true}).selectOption('21-100-01');await page.getByLabel('ID Place of Business Activity',{exact:true}).selectOption('0012345678910000000000');await page.locator('#g').fill('10000000'); await page.getByRole('button',{name:'Simpan draft',exact:true}).click();
  await expect.poll(async()=>(await readDb()).bupots.length).toBe(1);
  expect((await readDb()).bupots[0].withheld).toBe(200000);
  await page.getByRole('button',{name:'View RAKA',exact:true}).click();
  await expect(page.getByLabel('TIN',{exact:true})).toBeDisabled(); await page.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.getByRole('button',{name:'Edit RAKA',exact:true}).click();
  await page.getByLabel('Position',{exact:true}).fill('Staf Keuangan');
  await page.getByRole('button',{name:'Simpan Perubahan'}).click();
  await expect(page.getByText('Data berhasil disimpan.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.getByRole('checkbox',{name:'Pilih RAKA',exact:true}).check(); await sign();
  await expect.poll(async()=>(await readDb()).bupots[0].status).toBe('ISSUED');
  for (const label of ['Export CSV','Export XLSX','Export PDF']) {
    const download=page.waitForEvent('download'); await page.getByRole('button',{name:label,exact:true}).click();
    expect((await download).suggestedFilename()).toMatch(/\.(csv|xlsx|pdf)$/);
  }
  // A separate record verifies deletion without removing the record used by SPT.
  await page.getByRole('button',{name:'Belum Terbit',exact:true}).click();
  await page.getByRole('button',{name:'+ Buat eBupot MP',exact:true}).click();
  await page.locator('#p').selectOption('K/0');await page.locator('#m').selectOption('9');await page.locator('#y').fill('2024');await page.getByLabel('Tax Object Name',{exact:true}).selectOption('21-100-01');await page.getByLabel('ID Place of Business Activity',{exact:true}).selectOption('0012345678910000000000');await page.locator('#n').fill('3217122601770007');await page.locator('#g').fill('6000000');
  await page.getByRole('button',{name:'Simpan draft',exact:true}).click();
  await page.getByRole('checkbox',{name:'Pilih RAKA',exact:true}).check();
  await page.getByRole('button',{name:'Hapus',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Hapus',exact:true}).click();
  await expect.poll(async()=>(await readDb()).bupots.length).toBe(1);
  await page.goto('http://localhost:3000/ebupot/bp21');
  await page.getByRole('button',{name:'+ Buat eBupot BP21',exact:true}).click();
  await page.locator('#bp21-month').selectOption('9');await page.locator('#bp21-year').fill('2024');
  await page.locator('#bp21-tin').fill('3217122601770007');await page.locator('#bp21-gross').fill('2000000');
  await page.getByLabel('Status of Tax Exemption',{exact:true}).selectOption('K/3');await page.locator('#bp21-object').selectOption('jasa');await page.locator('#bp21-doc-type').selectOption('Bukti Pembayaran');await page.locator('#bp21-tku').selectOption('0012345678910000000000');await page.locator('#bp21-doc-number').fill('456');await page.locator('#bp21-doc-date').fill('2024-09-20');
  await page.getByRole('button',{name:'Simpan Draft',exact:true}).click();
  await page.getByRole('checkbox',{name:'Pilih RAKA',exact:true}).check();await sign();
  expect((await readDb()).bupots.find(b=>b.kind==='BP21').withheld).toBe(50000);
  await page.goto('http://localhost:3000/ebupot/bpa2');await page.getByRole('button',{name:'+ Buat eBupot BPA2',exact:true}).click();
  await page.locator('#bpa2-start').selectOption('1');await page.locator('#bpa2-end').selectOption('9');await page.locator('#bpa2-year').fill('2024');
  await page.locator('#bpa2-tin').fill('3217122601770007');await page.locator('#bpa2-ptkp').selectOption('TK/0');
  await page.getByLabel('Gender',{exact:true}).selectOption('Pria');await page.getByLabel('Class/Rank',{exact:true}).fill('IIIa');await page.getByLabel('Tax Object Name',{exact:true}).selectOption('21-100-01');await page.getByLabel('ID Place of Business Activity',{exact:true}).selectOption('0012345678910000000000');await page.locator('#bpa2-salary').fill('110000000');await page.locator('#bpa2-deduction').fill('4500000');await page.locator('#bpa2-previous').fill('3400000');
  await page.getByRole('button',{name:'Simpan Draft',exact:true}).click();await page.getByRole('checkbox',{name:'Pilih RAKA',exact:true}).check();await sign();
  const bpa=(await readDb()).bupots.find(b=>b.kind==='BPA2');expect(bpa.taxPeriodMonth).toBe(9);expect(bpa.fields.balance).toBe(-825000);
  const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Download BP A2',exact:true}).click();expect((await dl).suggestedFilename()).toMatch(/\.pdf$/);
  await page.goto('http://localhost:3000/spt');await page.getByRole('button',{name:'+ Buat Konsep SPT',exact:true}).click();
  await page.getByRole('button',{name:'PPh Pasal 21/26',exact:true}).click();await page.getByRole('button',{name:'Lanjut',exact:true}).click();
  await page.locator('select').last().selectOption('9');await page.locator('input[type=number]').fill('2024');await page.getByRole('button',{name:'Lanjut',exact:true}).click();await page.getByRole('button',{name:'Buat Konsep SPT',exact:true}).click();
  await page.waitForURL(/\/spt\/.+/);
  for (const tab of ['L-IA','L-IB','L-III']) {await page.getByRole('button',{name:tab,exact:true}).click();await expect(page.getByRole('cell',{name:'RAKA',exact:true})).toBeVisible();}
  await page.getByRole('button',{name:'L-II',exact:true}).click();await page.getByRole('button',{name:'BPA2',exact:true}).click();await expect(page.getByRole('cell',{name:'RAKA',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Halaman Utama',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Bayar dan Lapor',exact:true}).click();await page.locator('#sd-pass').fill('simulasi');await page.getByRole('dialog').getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('button',{name:'Konfirmasi Tanda Tangan'}).click();
  await expect.poll(async()=>(await readDb()).spts[0].status).toBe('DILAPORKAN');
  await page.goto('http://localhost:3000/ebupot/bp21');await page.getByRole('button',{name:'Telah Terbit',exact:true}).click();await page.getByRole('checkbox',{name:'Pilih RAKA',exact:true}).check();await page.getByRole('button',{name:'Batal',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Batalkan',exact:true}).click();
  await expect.poll(async()=>(await readDb()).bupots.find(b=>b.kind==='BP21').status).toBe('CANCELLED');
  expect(errors).toEqual([]);
});
