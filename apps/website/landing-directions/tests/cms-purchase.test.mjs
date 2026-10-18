import {test} from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../src/content/snapshot.js';
import templates from '../src/content/strings-templates.js';
import {run} from '../src/content/copy.js';
import {getPaymentMethod,validateTestPaymentDetails,TEST_CARD_EXPIRY,TEST_CARD_SECURITY_CODE} from '../src/reference/purchase-payment.js';
const slotFor = id => {
 const [entry,block,slot]=templates[id].k.split('|');
 return [snapshot.entries.strings.find(e=>e.id===entry).locales.en[block],slot];
};
test('payment labels resolve CMS changes after module initialization',()=>{
 const method=getPaymentMethod('card');const [block,key]=slotFor('purchase-payment:1');const before=block[key];
 try {block[key]='Edited payment label';assert.equal(method.name,'Edited payment label');assert.equal(method.id,'card');}
 finally {block[key]=before;}
});
test('CMS payment validation keeps synthetic values in code-backed placeholders',()=>{
 const id=Object.keys(templates).find(k=>k.startsWith('purchase-payment:')&&templates[k].seed==='Use the test expiry {0}.');
 const [block,key]=slotFor(id);const before=block[key];
 try {block[key]='Edited guidance: {0}';assert.equal(validateTestPaymentDetails('card',{}).expiry,`Edited guidance: ${TEST_CARD_EXPIRY}`);assert.equal(TEST_CARD_SECURITY_CODE,'123');}
 finally {block[key]=before;}
});
test('copy runs interpolate locked test values without changing existing calls',()=>{
 const key='gl_commerce|paymentDetails-intro|p';const text=Array.from({length:12},(_,i)=>run(key,i,['4242 4242 4242 4242','5555 5555 5555 4444',TEST_CARD_EXPIRY,TEST_CARD_SECURITY_CODE])).join('');
 assert.ok(text.includes('4242 4242 4242 4242'));assert.ok(text.includes(TEST_CARD_EXPIRY));assert.ok(!text.includes('{0}'));assert.ok(run(key,1).includes('{0}'));
});
