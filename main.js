
const { Parser } = require('./parser.js');
const { Model } = require('./model.js');

let p = new Parser();
p.parse('./m.mmdl');
let m = new Model(p.getRoot(), 'ROOT');
console.log(JSON.stringify(m, null, 4));

process.exit();

if (0) {

const fs = require('fs');

function parseFile(file, root)
{
    let lines = fs.readFileSync(file, 'UTF-8');
    lines = lines.split(/\r?\n/);
    root.text = 'MODEL';
    root.loc = file;
    root.sub = root.sub || [];
    let cur = root;
    let ind = '';
    let last = null;
    let indStack = [];
    let objStack = [];
    for (let i = 0; i < lines.length; i++)
    {
        let line = lines[i].trimRight();
        if (line.trim().startsWith('##') || line.trim() == '') continue;
        if (!line.startsWith(ind)) {
            // indent decreased - go back to parent object and try again this line
            cur = objStack.pop();
            ind = indStack.pop();
            i--;
            continue;
        } else if (line.startsWith(ind + ' ') || line.startsWith(ind + '\t')) {
            // indent increased - go inside last object and try again this line
            indStack.push(ind);
            objStack.push(cur);
            cur = last;
            ind = line.replace(/^(\s*).*$/, '$1');
            i--;
            continue;
        } else {
            last = { text: line.trim(), loc: `${file}:${i + 1}`, sub: [] };
            cur.sub.push(last);
        }
    }
}

function joinCode(sub, ind)
{
    let code = '';
    for (let entry of sub)
    {
        code += `${ind}${entry.text}\r\n`;
        code += joinCode(entry.sub, `${ind}    `);
    }
    return code;
}

function constructCode(entry, inlineCode)
{
    if (inlineCode)
    {
        if (entry.sub.length)
            throw Error(`${entry.sub[0].loc}: code already provided.`);
        return `    ${inlineCode};\r\n`;
    }
    else
    {
        if (entry.sub.length == 0 && !inlineCode)
            throw Error(`${entry.loc}: no code provided.`);
        return joinCode(entry.sub, '    ');
    }
}

function explodeNames(entry, namesStr)
{
    let list = namesStr.split(/\s*,\s*/);
    for (let n of list)
        if (!n.match(/^@[A-Za-z0-9_]+[#`]?$/))
            throw new MmdlError(entry, 'Invalid name');
    return list;
}

function addPrefix(prefix, obj)
{
    return JSON.parse(JSON.stringify(obj).replace(/@/g, `@${prefix}`));
}

class MmdlError extends Error
{
    constructor(entry, text)
    {
        super(`${entry.loc}: ${text}`);
    }
};


class Class
{
    /*
    
class items:
    - /struct code - code to place in state structure that must contains one @ symbol with field name
    - /init - code to place in state initialization function
    - /init x = code; - short notation of state initialization
    - /finalize - code to finalize state (e.g. free memory)
    - /local - code to place in simulation function local variables
    - /output [name[,name[,...]]] - code to calculate output data (multiple outputs should be grouped only if needed)
            names starting with _ are private
    - /output name = code; - short notation of above
    - /provide [name[,name[,...]]] - like output, but does not allocate local variables automatically
    - /override [name[,name[,...]]] - code that overrides symbols with value for the next step
    - state x - code to calculate next value of the state (using differential or directly)
    - state x` = code; - short notation of differential
    - state x# = code; - short notation of direct calculation of next state value
    - /default name = code; - code to calculate input value if it is not connected
    
    */
    constructor(classEntry, name)
    {
        this.name = name;
        this.loc = classEntry.loc;
        this.struct = '';
        this.local = '';
        this.restore = '';
        this.store = '';
        this.finalize = '';
        this.expressions = [];
        this.fieldNames = {};
        this.localNames = {};
        this.parseSub(classEntry.sub);
        this.postProcessSub();
        //this.processSub();
    }

    postProcessSub()
    {
        for (let exp of this.expressions)
        {
            if (exp.init)
            {
                for (let name in this.fieldNames) exp.requires = exp.requires.filter(n => (n != name));
            }
        }
        let ids = {};
        this.expressions = this.expressions.filter(exp => {
            if (exp.uniqueId)
            {
                if (exp.uniqueId in ids) return false;
                ids[exp.uniqueId] = true;
            }
            return true;
        });
    }
    
    parseSub(sub)
    {
        let m;
        let patterns = [
            [ /^struct\s+(.+)$/,
                (e) => this.addStructField(e, e.constructCode(e[1])) ],
            [ /^struct$/,
                (e) => this.addStructField(e, e.constructCode()) ]
            [ /.*/,
                (e) => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let entry of sub)
        {
            if ((m = entry.text.match(/^struct\s+(.+)$/)))
                this.addStructField(entry, constructCode(entry, m[1]));
            else if ((m = entry.text.match(/^struct$/)))
                this.addStructField(entry, constructCode(entry));
            else if ((m = entry.text.match(/^local\s+(.+)$/)))
                this.addLocal(entry, constructCode(entry, m[1]));
            else if ((m = entry.text.match(/^local$/)))
                this.addLocal(entry, constructCode(entry));
            else if ((m = entry.text.match(/^(finalize)$/)))
                this.addSimpleEntry(entry, m[1], constructCode(entry));
            else if ((m = entry.text.match(/^(finalize)\s+(.+)$/)))
                this.addSimpleEntry(entry, m[1], constructCode(entry, m[2]));
            else if ((m = entry.text.match(/^output?\s+([a-zA-Z0-9_,\s@#`]+)$/)))
                this.addOutput(entry, explodeNames(entry, m[1]), constructCode(entry), true);
            else if ((m = entry.text.match(/^output?\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/)))
                this.addOutput(entry, explodeNames(entry, m[1]), constructCode(entry, `${m[1]} = ${m[2]}`), true);
            else if ((m = entry.text.match(/^provides?\s+([a-zA-Z0-9_,\s@#`]+)$/)))
                this.addOutput(entry, explodeNames(entry, m[1]), constructCode(entry), false);
            else if ((m = entry.text.match(/^provides?\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/)))
                this.addOutput(entry, explodeNames(entry, m[1]), constructCode(entry, `${m[1]} = ${m[2]}`), false);
            else if ((m = entry.text.match(/^overrides?\s+([a-zA-Z0-9_,\s@#`]+)$/)))
                this.addOverride(entry, explodeNames(entry, m[1]), constructCode(entry));
            else if ((m = entry.text.match(/^overrides?\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/)))
                this.addOverride(entry, explodeNames(entry, m[1]), constructCode(entry, `${m[1]} = ${m[2]}`));
            else if ((m = entry.text.match(/^default?\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/)))
                this.addOutput(entry, explodeNames(entry, m[1]), constructCode(entry, `${m[1]} = ${m[2]}`), true, true);
            else if ((m = entry.text.match(/^init\s+(.+)$/)))
                this.addInit(entry, constructCode(entry, m[1]));
            else if ((m = entry.text.match(/^init$/)))
                this.addInit(entry, constructCode(entry));
            else if ((m = entry.text.match(/^state?\s+(@[a-zA-Z0-9_]+)(#|`)\s*=\s*(.+)$/)))
                this.addState(entry, explodeNames(entry, m[1]), m[2], constructCode(entry, `${m[1]}${m[2]} = ${m[3]}`));
            else if ((m = entry.text.match(/^state?\s+(@[a-zA-Z0-9_]+)(#|`)$/)))
                this.addState(entry, explodeNames(entry, m[1]), m[2], constructCode(entry));
            else
                throw Error(`${entry.loc}: Syntax error.`);
        }
    }

    addState(entry, names, type, code)
    {
        let name = names[0];
        if (type == '`')
        {
            this.addExpression(entry, [ `${name}\`` ], [], code);
            this.addExpression(entry, [ `${name}#` ], [], `    ${name}# = ${name}\` * dt;\r\n`);
            if (!this.localNames[`${name}\``])
            {
                this.local += `   double ${name}\`;\r\n`;
                this.localNames[`${name}\``] = true;
            }
        }
        else
        {
            this.addExpression(entry, [ `${name}#` ], [], code);
        }
        let exp = this.addExpression(entry, [], [ name ], `    ${name} = ${name}#;\r\n`);
        exp.uniqueId = `override state ${name}`;
        if (!this.localNames[`${name}#`])
        {
            this.local += `   double ${name}#;\r\n`;
            this.localNames[`${name}#`] = true;
        }
        if (!this.fieldNames[name])
        {
            this.struct += `   double ${name};\r\n`;
            this.fieldNames[name] = true;
        }
    }

    addStructField(entry, code)
    {
        code.replace(/@[A-Za-z0-9_]+/g, m => this.fieldNames[m] = true);
        this.struct += code;
    }

    addLocal(entry, code)
    {
        code.replace(/@[A-Za-z0-9_]+/g, m => this.localNames[m] = true);
        this.local += code;
    }

    addSimpleEntry(entry, name, code)
    {
        this[name] += code;
    }

    addOutput(entry, names, code, addLocal, optional)
    {
        let exp = this.addExpression(entry, names, [], code);
        exp.optional = !!optional;
        if (addLocal)
        {
            exp.local = '';
            for (let n of names)
            {
                exp.local += `    double ${n};\r\n`;
                this.localNames[n] = true;
            }
        }
    }

    addOverride(entry, names, code)
    {
        this.addExpression(entry, [], names, code);
    }

    addInit(entry, code)
    {
        let exp = this.addExpression(entry, [], [], code);
        exp.init = true;
    }

    addExpression(entry, provides, overrides, code)
    {
        let requires = {};
        code.replace(/(@[a-zA-Z0-9_]+[#`]?)/g, id => { requires[id] = true; });
        for (let p of provides) delete requires[p];
        for (let p of overrides) delete requires[p];
        let exp = {
            loc: entry.loc,
            provides: provides,
            overrides: overrides,
            requires: Object.keys(requires),
            optional: false,
            init: false,
            local: '',
            code: code
        };
        this.expressions.push(exp);
        return exp;
    }

    addPrefix(prefix)
    {
        this.struct = addPrefix(prefix, this.struct);
        this.local = addPrefix(prefix, this.local);
        this.restore = addPrefix(prefix, this.restore);
        this.store = addPrefix(prefix, this.store);
        this.finalize = addPrefix(prefix, this.finalize);
        this.expressions = addPrefix(prefix, this.expressions);
        this.fieldNames = addPrefix(prefix, this.fieldNames);
        this.localNames = addPrefix(prefix, this.localNames);
    }
};


class Model
{
    constructor(modelEntry, name, parent)
    {
        Object.defineProperty(this, "parent", { enumerable: false, writable: true });
        this.loc = modelEntry.loc;
        this.name = name;
        this.parent = parent;
        this.classes = {};
        this.objects = {};
        this.parseSub(modelEntry.sub);
    }

    parseSub(sub)
    {
        let m;
        for (let entry of sub)
        {
            if ((m = entry.text.match(/^class\s+([a-zA-Z0-9_]+)$/)))
                this.classes[m[1]] = new Class(entry, m[1]);
            else if ((m = entry.text.match(/^model\s+([a-zA-Z0-9_]+)$/)))
                this.classes[m[1]] = new Model(entry, m[1], this);
            else if ((m = entry.text.match(/^([a-zA-Z0-9_]+)$/)))
                this.addObject(entry, m[1], m[1]);
            else if ((m = entry.text.match(/^([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)$/)))
                this.addObject(entry, m[1], m[2]);
            else
                throw Error(`${entry.loc}: Syntax error.`);
        }
    }

    addObject(entry, name, className)
    {
        let cls = this.findClass(entry, className);
        let obj = Object.create(cls);
        obj.addPrefix(`${name}__`);
        obj.setInstanceEntry(entry);
        this.objects[name] = obj;
    }

    findClass(entry, className)
    {
        let model = this;
        while (model)
        {
            if (model.classes[className]) return model.classes[className];
            model = model.parent;
        }
        throw new MmdlError(entry, `Cannot find class ${className}`);
    }

}



let root = {};
parseFile('./m.mmdl', root);
//console.log(JSON.stringify(root, null, 4));
console.log(JSON.stringify(new Model(root, 'mmdl', null), null, 4));


/*

class Class
{
    constructor(classEntry, name)
    {
        this.name = name;
        this.loc = classEntry.loc;
        this.states = {};
        this.inputs = {};
        this.outputs = {};
        this.defaults = {};
        this.parseSub(classEntry.sub);
        this.processSub();
    }

    processSub()
    {
        for (let output of this.outputs)
        {
            output.depends = output.depends.filter((name) => (!(name in this.states) && !(name in this.outputs)));
        }
    }

    parseSub(sub)
    {
        for (let entry of sub)
        {
            if ((m = entry.text.match(/^output\s+([a-zA-Z0-9_]+)$/)))
                this.addOutput(m[1], entry, this.getCode(entry));
            else if ((m = entry.text.match(/^output\s+([a-zA-Z0-9_]+)\s*=\s*(.+)$/)))
                this.addOutput(m[1], entry, this.getCode(entry, m[2]));
            else
                throw Error(`${entry.loc}: Syntax error.`);
        }
    }

    getCode(entry, inlineCode)
    {
        if (inlineCode)
        {
            if (entry.sub.length)
                throw Error(`${entry.sub[0].loc}: code already provided.`);
            return `    ${inlineCode}`;
        }
        else
        {
            if (entry.sub.length == 0 && !inlineCode)
                throw Error(`${entry.loc}: no code provided.`);
            return joinCode(entry.sub, '    ');
        }
    }

    addOutput(name, entry, code)
    {
        if (name in this.outputs)
            throw Error(`${entry.loc}: Output already defined.`);
        let depends = [];
        code.replace(/@([A-Za-z0-9_]+)/g, (_,m) => { depends.push(m); });
        this.outputs[name] = {
            name: name,
            code: code,
            depends: depends
        }
    }

    getStateCode(prefix)
    {
        let str = '';
        for (let s in states)
            str += `    number_t ${prefix}${s}\r\n`;
        return str;
    }

    getRestoreCode(prefix)
    {
        let str = '';
        for (let s in states)
            str += `    number_t ${prefix}${s} = state.${prefix}${s}\r\n`
                + `    number_t ${prefix}${s}__next\r\n`
                + `    number_t ${prefix}${s}__det\r\n`;                
        return str;
    }

    getStoreCode(prefix)
    {
        let str = '';
        for (let s in states)
            str += `    state.${prefix}${s} = ${prefix}${s};\r\n`;
        return str;
    }

    getOutputs()
    {
        let r = {};
        for (let name in this.outputs)
            r[name] = this.outputs.depends;
        return r;
    }

    getInputs()
    {
        let r = {};
        for (let name in this.inputs)
            r[name] = !!this.inputs.defaultCode;
        return r;
    }

    getOutputCode(prefix, name)
    {
        let output = this.outputs[name];
        return output.code.replace('@', prefix);
    }

    getNextStateCode(prefix)
    {
        return this.nextStateCode.replace('@', prefix);
    }

    getApplyCode(prefix)
    {
        let str = '';
        for (let s in states)
            str += `    ${prefix}${s} = ${prefix}${s}__next;\r\n`;
        return str;
    }
}


//console.log(JSON.stringify(root, null, 4));

/*

class {name}
    state|output|default {name}[`|#]
        C code
    state {name}` = C expression
    ===>
    state {name}`
        {name}` = C expression

*/

}
