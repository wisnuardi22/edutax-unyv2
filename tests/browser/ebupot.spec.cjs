const {test,expect}=require('@playwright/test');
let pageErrors=[];
test.beforeEach(async({page})=>{pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));});
test.afterEach(()=>expect(pageErrors).toEqual([]));
const tin='0012345678910000',nik='3217122601770007',nitku=tin+'000000';
const gross={salaryPensionThtJht:110000000,wifeIncomeBenefit:0,childrenIncomeBenefit:0,incomeImprovementBenefit:0,structuralFunctionalBenefit:0,riceIncomeBenefit:0,otherIncomeBenefit:0,otherFixedRegularIncome:0};
const fields={startMonth:1,startYear:2024,ptkp:'K/0',nip:'123123123123',gender:'Pria',golongan:'IIIa',jabatan:'Staf',statusWithholding:'Kurang dari Setahun',grossIncome:gross,netIncome:105000000,taxLiability:2325000,underOverPayment:-1075000,lastPeriodGross:10000000};
const bpa2={id:'annual',kind:'BPA2',entityTin:tin,status:'DRAFT',withholdingNumber:null,taxPeriodMonth:10,taxPeriodYear:2024,counterpartTin:nik,counterpartName:'RAKA',taxObjectCode:'21-100-01',gross:110000000,rate:0,withheld:2325000,idPlaceOfBusinessActivity:nitku,createdByNik:nik,createdAt:'2024-10-31T00:00:00Z',signature:null,cancelledAt:null,fields};
const manual={nonLsPayment:0,sp2d:0,dtp:0,paidOnCorrectedReturn:0};
const spt={id:'october',entityTin:tin,kind:'PPH_21_26',model:'NORMAL',pembetulanKe:0,taxPeriodMonth:10,taxPeriodYear:2024,status:'KONSEP',manualArticle21:manual,manualArticle26:manual,declaration:{agreed:false,signedAs:'TAXPAYER',signerName:'RAKA'},signature:null,billing:null,createdAt:'2024-10-31T00:00:00Z',submittedAt:null};
function fixture(bupots=[bpa2]) {return {schemaVersion:3,persons:[{nik,nama:'RAKA',padan:true,alamat:'Yogyakarta',negara:'Indonesia',ptkp:'K/0',nip:'123123123123',gender:'Pria',golongan:'IIIa',jabatan:'Staf'}],entities:[{tin,name:'INSTANSI PEMERINTAH XYZ',address:'Yogyakarta',nitkuPusat:nitku}],tkus:[{nitku,entityTin:tin,nama:'Pusat',picNiks:[nik]}],roleAssignments:[],relatedParties:[{entityTin:tin,personNik:nik,isPic:true}],bupots,spts:[spt],session:{personNik:nik,personName:'RAKA',impersonatingTin:tin,activeNitku:null,loggedInAt:'2024-10-31T00:00:00Z'},mainAccountProfile:{nik,nama:'RAKA',signingCredential:{provider:'KODE_OTORISASI_DJP',passphrase:'test-pass',signerId:null}},counters:{},auditTrail:[]};}
async function seed(page,db){await page.addInitScript(db=>{if(!localStorage.getItem('edutax.uny.v1.db'))localStorage.setItem('edutax.uny.v1.db',JSON.stringify(db));},db);}
async function state(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('edutax.uny.v1.db')));}
test('legacy BPA2 edit, issue, October L-IB, L-II, declaration',async({page})=>{
 await seed(page,fixture());await page.goto('/ebupot/bpa2');
 await page.getByTitle('Edit',{exact:true}).click();
 await expect(page.locator('#taxw')).toHaveValue('3400000');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();
 expect((await state(page)).bupots[0].fields.underOverPayment).toBe(-1075000);
 await page.getByTitle('Edit',{exact:true}).click();await expect(page.locator('#taxw')).toHaveValue('3400000');
 await page.getByRole('button',{name:'Submit',exact:true}).click();
 await page.getByRole('checkbox',{name:'Pilih bupot RAKA'}).check();await page.getByRole('button',{name:'Terbitkan',exact:true}).click();
 await page.locator('#sd-pass').fill('test-pass');await page.getByRole('button',{name:'Konfirmasi Tanda Tangan',exact:true}).click();
 await expect(page.getByText('Data successfully issued!',{exact:true})).toBeVisible();
 await page.goto('/spt/october');await page.getByRole('button',{name:'L-IB',exact:true}).click();
 await expect(page.locator('tbody')).toContainText('RAKA');await expect(page.locator('tbody')).toContainText('-1.075.000');
 await expect(page.locator('tbody')).toContainText('10.000.000');
 await page.screenshot({path:'tmp/spt-lib.png',fullPage:true});
 await page.getByRole('button',{name:'L-II',exact:true}).click();await expect(page.locator('tbody')).toContainText('110.000.000');
 await page.getByRole('button',{name:'Halaman Utama',exact:true}).click();await expect(page.locator('#signer-name')).toHaveValue('RAKA');
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Bayar dan Lapor',exact:true}).click();
 await page.locator('#sd-pass').fill('test-pass');await expect(page.getByRole('button',{name:'Konfirmasi Tanda Tangan',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.getByRole('button',{name:'Konfirmasi Tanda Tangan',exact:true}).click();
 expect((await state(page)).spts[0].status).toBe('DILAPORKAN');expect((await state(page)).spts[0].snapshot.bupots).toHaveLength(1);
});
test('BP21 L-III columns and downloadable billing PDF',async({page})=>{
 const bp={...bpa2,id:'expert',kind:'BP21',status:'ISSUED',withholdingNumber:'2400000565',gross:2000000,withheld:50000,taxObjectCode:'21-100-07',fields:{withholdingDate:'2024-10-30'}};
 await seed(page,fixture([bp]));await page.goto('/spt/october');await page.getByRole('button',{name:'L-III',exact:true}).click();
 const cells=page.locator('tbody tr').first().locator('td');await expect(cells).toHaveCount(13);await expect(cells.nth(3)).toHaveText('Pasal 21');await expect(cells.nth(4)).toHaveText('2400000565');await expect(cells.nth(5)).toHaveText('30-10-2024');await expect(cells.nth(8)).toHaveText('50.000');
 await page.getByRole('button',{name:'Halaman Utama',exact:true}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Bayar dan Lapor',exact:true}).click();await page.locator('#sd-pass').fill('test-pass');await page.getByRole('button',{name:'Simpan',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Konfirmasi Tanda Tangan',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.pdf$/);await file.saveAs('tmp/billing-test.pdf');
 expect((await state(page)).spts[0].status).toBe('MENUNGGU_PEMBAYARAN');await page.getByRole('button',{name:'Simulasikan Pembayaran',exact:true}).click();expect((await state(page)).spts[0].status).toBe('DILAPORKAN');
});
test('empty Submit is blocked and unknown recipient confirmation is preserved',async({page})=>{
 await seed(page,fixture([]));await page.goto('/ebupot/bpa2');await page.getByRole('button',{name:'+ Create eBupot BPA2',exact:true}).click();await page.getByRole('button',{name:'Submit',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('16 digit');expect((await state(page)).bupots).toHaveLength(0);
 await page.locator('#btin').fill('1234567890123456');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Save Draft',exact:true}).click();
 const saved=(await state(page)).bupots[0];expect(saved.counterpartTin).toBe('9990000000999000');expect(saved.fields.originalTin).toBe('1234567890123456');
});
test('BPMP calculation, XML import preserves date and object on edit',async({page})=>{
 await seed(page,fixture([]));await page.goto('/ebupot/bpmp');
 await page.getByRole('button',{name:'+ Create eBupot MP',exact:true}).click();
 await page.locator('#n').fill(nik);await page.locator('#g').fill('10000000');
 await page.getByRole('button',{name:'Submit',exact:true}).click();
 const first=(await state(page)).bupots[0];expect(first.rate).toBe(2);expect(first.withheld).toBe(200000);
 const headers=['TIN','TaxPeriodMonth','TaxPeriodYear','CounterpartOption','CounterpartPassport','CounterpartTin','StatusTaxExemption','Position','TaxCertificate','TaxObjectCode','Gross','Rate','IDPlaceOfBusinessActivity','WithholdingDate'];
 const values=[tin,9,2024,'Resident','',nik,'K/0','Staf','Tanpa Fasilitas','21-100-02',10000000,2,nitku,'18/09/2024'];
 const row=values=>'<ss:Row>'+values.map(v=>'<ss:Cell><ss:Data ss:Type="String">'+v+'</ss:Data></ss:Cell>').join('')+'</ss:Row>';
 const xml='<?xml version="1.0"?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><ss:Worksheet ss:Name="Data"><ss:Table>'+row(headers)+row(values)+'</ss:Table></ss:Worksheet></ss:Workbook>';
 await page.getByRole('button',{name:'Impor data',exact:true}).click();const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload File',exact:true}).click();await (await picker).setFiles({name:'import.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await expect(page.getByText('1 bukti pemotongan berhasil diimpor ke daftar Belum Terbit.',{exact:true})).toBeVisible();
 const imported=(await state(page)).bupots[1];expect(imported.fields.withholdingDate).toBe('2024-09-18');expect(imported.taxObjectCode).toBe('21-100-02');
 await page.getByTitle('Edit',{exact:true}).nth(1).click();await page.getByRole('button',{name:'Save Draft',exact:true}).click();const edited=(await state(page)).bupots[1];expect(edited.taxObjectCode).toBe('21-100-02');expect(edited.fields.withholdingDate).toBe('2024-09-18');
});
test('Get data retrieves an accessible previous employer slip only',async({page})=>{
 const previousTin='0012345678910001';
 const previous={...bpa2,id:'previous',entityTin:previousTin,status:'ISSUED',withholdingNumber:'PREVIOUS-1',taxPeriodMonth:3,withheld:150000,fields:{...fields,netIncome:20000000,underOverPayment:0}};
 const current={...bpa2,fields:{...fields,startMonth:4}};
 const db=fixture([current,previous]);db.relatedParties.push({entityTin:previousTin,personNik:nik,isPic:true});
 await seed(page,db);await page.goto('/ebupot/bpa2');await page.getByTitle('Edit',{exact:true}).click();await page.locator('#psn').fill('PREVIOUS-1');await page.getByRole('button',{name:'Get data',exact:true}).click();
 await expect(page.locator('#nifp')).toHaveValue('20000000');await expect(page.locator('#wfp')).toHaveValue('150000');
 await page.locator('#psn').fill('MISSING');await page.getByRole('button',{name:'Get data',exact:true}).click();await expect(page.locator('p[role=alert]')).toContainText('Slip tidak ditemukan');
});
