
const { Parser } = require('./parser.js');
const { Model } = require('./model.js');

let p = new Parser();
p.parse('./m.mmdl');
let m = new Model(p.getRoot(), 'ROOT');
//console.log(JSON.stringify(m.expressions, null, 4));
console.log(m);

setTimeout(()=>{}, 1000 * 1000);
