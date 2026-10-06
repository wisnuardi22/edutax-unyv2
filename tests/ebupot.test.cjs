const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TER_TABLE, terRate, withheldByTer } = require('../src/lib/domain/ter.ts');
const { calculateBpa2, previouslyWithheld } = require('../src/lib/domain/bpa2.ts');
const { BP21_TAX_OBJECTS, withheldByTaxObject } = require('../src/lib/domain/bp21.ts');
const { resolveRecipient, validateBupot, parseWithholdingDate } = require('../src/lib/domain/bupotValidation.ts');
const { buildArticleSummary, periodGross } = require('../src/lib/domain/sptCalc.ts');
const manual = { sp2d:0, dtp:0, nonLsPayment:0, paidOnCorrectedReturn:0 };
const spt = (month=10) => ({ id:'s'+month, entityTin:'entity', kind:'PPH_21_26', taxPeriodMonth:month, taxPeriodYear:2024, status:'KONSEP', model:'NORMAL', pembetulanKe:0, manualArticle21:{...manual}, manualArticle26:{...manual} });
const annual = { id:'a2', kind:'BPA2', entityTin:'entity', status:'ISSUED', taxPeriodMonth:10, taxPeriodYear:2024, counterpartTin:'3217122601770007', counterpartName:'RAKA', gross:110000000, withheld:2325000, idPlaceOfBusinessActivity:'nitku', fields:{ startMonth:1, startYear:2024, ptkp:'K/0', nip:'123', golongan:'IIIa', jabatan:'Staf', statusWithholding:'Kurang dari Setahun', underOverPayment:-1075000, lastPeriodGross:10000000, taxWithheld:3400000 } };
const gross = {salaryPensionThtJht:110000000,wifeIncomeBenefit:0,childrenIncomeBenefit:0,incomeImprovementBenefit:0,structuralFunctionalBenefit:0,riceIncomeBenefit:0,otherIncomeBenefit:0,otherFixedRegularIncome:0};
test('PDF BPMP examples and all TER upper boundaries', () => {
 assert.deepEqual(withheldByTer('K/0',10000000),{rate:2,withheld:200000});
 assert.equal(terRate('K/0',40000000),16);
 assert.equal(terRate('K/0',100000000),24);
 for(const [cat,ptkp] of [['A','K/0'],['B','K/1'],['C','K/3']]) {
  const table=TER_TABLE[cat];
  table.forEach(([limit,rate],i) => { if(Number.isFinite(limit)) { assert.equal(terRate(ptkp,limit),rate); assert.equal(terRate(ptkp,limit+.01),table[i+1][1]); } });
 }
 assert.equal(terRate('K/3',2000000000),34);
});
test('PDF expert example and progressive amount above first bracket',()=>{
 assert.equal(withheldByTaxObject(BP21_TAX_OBJECTS[0].name,2000000).withheld,50000);
 assert.equal(withheldByTaxObject(BP21_TAX_OBJECTS[0].name,200000000).withheld,9000000);
});
test('BPA2 save/edit and legacy recovery preserve withholding',()=>{
 const input={gross,months:10,ptkp:'K/0',netIncomeFromPrevious:0,article21TaxWithheldFromPrevious:0,article21TaxWithheld:3400000};
 const calc=calculateBpa2(input); assert.equal(calc.underOverPayment,-1075000);
 assert.equal(previouslyWithheld(annual),3400000);
 const legacy=structuredClone(annual);delete legacy.fields.taxWithheld;
 assert.equal(previouslyWithheld(legacy),3400000);
 assert.equal(calculateBpa2({...input,article21TaxWithheld:previouslyWithheld(legacy)}).underOverPayment,-1075000);
 assert.equal(calculateBpa2({...input,gross:{...gross,salaryPensionThtJht:110000123}}).taxableIncome % 1000,0);
});
test('SPT October uses annual adjustment, excluding drafts/cancelled/other entities',()=>{
 const noise=['DRAFT','CANCELLED'].map(status=>({...annual,status,withheld:9999999}));
 const summary=buildArticleSummary(spt(),[annual,...noise,{...annual,entityTin:'other'}],'21');
 assert.equal(summary.balance,-1075000); assert.equal(summary.netPayable,0);
 assert.equal(periodGross(annual,[annual]),10000000);
 assert.equal(buildArticleSummary(spt(9),[annual],'21').balance,0);
});
test('SPT combines monthly paid amount and annual adjustment without annual total',()=>{
 const monthly={...annual,kind:'BPMP',gross:10000000,withheld:200000};
 assert.equal(buildArticleSummary(spt(),[annual,monthly],'21').balance,-875000);
});
test('Carry forward latest correction once and freeze filed inputs',()=>{
 const october={...spt(),status:'DILAPORKAN',snapshot:{bupots:[annual],carry21:0,carry26:0}};
 const november=spt(11),novBp={...annual,kind:'BPMP',taxPeriodMonth:11,withheld:200000};
 assert.equal(buildArticleSummary(november,[novBp],'21',[october]).balance,-875000);
 const filedNov={...november,status:'DILAPORKAN',snapshot:{bupots:[novBp],carry21:1075000,carry26:0}};
 assert.equal(buildArticleSummary(spt(12),[],'21',[october,filedNov]).balance,-875000);
 assert.equal(buildArticleSummary(october,[],'21').balance,-1075000);
});
test('Recipient unknown/unmatched uses sentinel, npwp16 alias works',()=>{
 const nik='3217122601770007', npwp16='1234567890123456';
 assert.equal(resolveRecipient([],nik,'').resolvedTin,'9990000000999000');
 assert.equal(resolveRecipient([{nik,npwp16,nama:'A',padan:true}],npwp16,'').name,'A');
 assert.equal(resolveRecipient([{nik,padan:false}],nik,'A').substituted,true);
 assert.equal(resolveRecipient([], '123', '').resolvedTin,'123');
});
test('Submit rejects invalid period, negative amount, missing reference and NITKU scope',()=>{
 assert.equal(validateBupot(annual,['nitku']),null);
 assert.match(validateBupot({...annual,fields:{...annual.fields,startMonth:11}},['nitku']),/Periode/);
 assert.match(validateBupot({...annual,gross:-1},['nitku']),/negatif/);
 assert.match(validateBupot(annual,[]),/NITKU/);
 assert.match(validateBupot({...annual,kind:'BP21',fields:{ptkp:'K/0',taxObjectName:BP21_TAX_OBJECTS[0].name}},['nitku']),/referensi/);
 assert.equal(parseWithholdingDate('31/02/2024'),null);
 assert.equal(parseWithholdingDate('18/09/2024'),'2024-09-18');
});
test('latest correction supersedes the original return for carry forward',()=>{
 const original={...spt(),status:'DILAPORKAN',snapshot:{bupots:[annual],carry21:0,carry26:0}};
 const correction={...original,id:'corrected',model:'PEMBETULAN',pembetulanKe:1,snapshot:{bupots:[{...annual,fields:{...annual.fields,underOverPayment:-50000}}],carry21:0,carry26:0}};
 assert.equal(buildArticleSummary(spt(11),[],'21',[original,correction]).balance,-50000);
});
