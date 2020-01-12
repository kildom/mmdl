
const { Template, LocationType } = require('./template.js');
const { MmdlError } = require('./utils.js');

class Class extends Template
{
    constructor(entry, name)
    {
        super(entry, name);
        this.parseSub(entry.sub);
    }

    parseSub(sub)
    {
        let patterns = [
            [ /^struct$/,
                e => this.addVariable(e, LocationType.Struct) ],
            [ /^struct\s+(.+)$/,
                e => this.addVariable(e, LocationType.Struct, e[1]) ],

            [ /^local$/,
                e => this.addVariable(e, LocationType.Local) ],
            [ /^local\s+(.+)$/,
                e => this.addVariable(e, LocationType.Local, e[1]) ],

            [ /^input\s+([a-zA-Z0-9_,\s@]+)$/,
                e => this.addInput(e, e[1]) ],

            [ /^output\s+([a-zA-Z0-9_,\s@]+)$/,
                e => this.addOutput(e, e[1]) ],
            [ /^output\s+(@[a-zA-Z0-9_]+)\s*=\s*(.+)$/,
                e => this.addOutput(e, e[1], `${e[1]} = ${e[2]}`) ],

            [ /^provide\s+(always|init|finalize)$/,
                e => this.addProvideAlways(e, e[1]) ],

            [ /^provide\s+([a-zA-Z0-9_,\s@#`]+)$/,
                e => this.addProvide(e, e[1]) ],
            [ /^provide\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                e => this.addProvide(e, e[1], `${e[1]} = ${e[2]}`) ],
            
            [ /^default\s+([a-zA-Z0-9_,\s@#`]+)$/,
                e => this.addDefault(e, e[1]) ],
            [ /^default\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                e => this.addDefault(e, e[1], `${e[1]} = ${e[2]}`) ],

            [ /^override\s+([a-zA-Z0-9_,\s@#`]+)$/,            
                e => this.addOverride(e, e[1]) ],
            [ /^override\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                e => this.addOverride(e, e[1], `${e[1]} = ${e[2]}`) ],

            [ /^init\s+([a-zA-Z0-9_,\s@#`]+)$/,
                e => this.addInit(e, e[1]) ],
            [ /^init\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                e => this.addInit(e, e[1], `${e[1]} = ${e[2]}`) ],

            [ /^finalize\s+([a-zA-Z0-9_,\s@#`]+)$/,
                e => this.addFinalize(e, e[1]) ],
            [ /^finalize\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                e => this.addFinalize(e, e[1], `${e[1]} = ${e[2]}`) ],

            [ /^state\s+(@[a-zA-Z0-9_]+)(#|`)\s*=\s*(.+)$/,
                e => this.addState(e, e[1], e[2], `${e[1]}${e[2]} = ${e[3]}`) ],
            [ /^state\s+(@[a-zA-Z0-9_]+)(#|`)$/,
                e => this.addState(e, e[1], e[2]) ],

            [ /.*/,
                e => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let entry of sub)
            entry.multiMatch(patterns);
    }

    addState(entry, name, type, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        if (type == '`')
        {
            this.addExpression(entry, `   double ${name}\`;\r\n`)
                .local()
                .provides(`${name}\``)
                .weak();
            this.addExpression(entry, code)
                .provides(`${name}\``)
                .requiresFromCode();
            this.addExpression(entry, `    ${name}# = ${name}\` * dt;\r\n`)
                .provides(`${name}#`)
                .requires(`${name}\``);
        }
        else
        {
            this.addExpression(entry, code)
                .provides(`${name}#`)
                .requiresFromCode();
        }
        this.addExpression(entry, `    ${name} = ${name}#;\r\n`)
            .overrides(name)
            .requires(`${name}#`);
        this.addExpression(entry, `   double ${name}#;\r\n`)
            .local()
            .provides(`${name}#`)
            .weak();
        this.addExpression(entry, `   double ${name};\r\n`)
            .struct()
            .provides(`${name}`)
            .weak();
    }

    addVariable(entry, location, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        let provides = {};
        code.replace(/@[A-Za-z0-9_]+(\`#)?/g, m => provides[m] = true);
        this.addExpression(entry, code)
            .location(location)
            .provides(Object.keys(provides));
    }

    addInput(entry, names)
    {
        if (entry.sub.length > 0)
            throw new MmdlError(entry.sub[0], "Unexpected code");
        names = this.explodeNames(entry, names);
        for (let n of names)
            this.inputs[n] = true;
    }

    addOutput(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        this.addExpression(entry, code)
            .provides(names)
            .requiresFromCode();
        for (let n of names)
        {
            this.addExpression(entry, `    double ${n};\r\n`)
                .local()
                .provides(n)
                .weak();
            this.outputs[n] = true;
        }
    }

    addProvide(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        this.addExpression(entry, code)
            .provides(names)
            .requiresFromCode();
    }

    addProvideAlways(entry, type)
    {
        let code = entry.constructCode();
        let tr = {
            always: LocationType.Step,
            init: LocationType.Init,
            finalize: LocationType.Finalize
        };
        this.addExpression(entry, code)
            .always(tr[type])
            .requiresFromCode();
    }
    
    addDefault(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        if (names.length > 1)
            throw new MmdlError(entry, "Only one default allowed!")
        this.addExpression(entry, code)
            .provides(names)
            .requiresFromCode()
            .weak();
        this.addExpression(entry, `    double ${names[0]};\r\n`)
            .local()
            .provides(names[0])
            .weak();
        this.inputs[names[0]] = false;
    }

    addOverride(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        this.addExpression(entry, code)
            .overrides(names)
            .requiresFromCode();
    }

    addInit(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        this.addExpression(entry, code)
            .init()
            .provides(names)
            .requiresFromCode();
    }

    addFinalize(entry, names, inlineCode)
    {
        let code = entry.constructCode(inlineCode);
        names = this.explodeNames(entry, names);
        this.addExpression(entry, code)
            .finalize()
            .provides(names)
            .requiresFromCode();
    }

    addExpression(entry, code)
    {

        let exp = {
            loc: entry.loc,
            location: LocationType.Step,
            provides: [],
            overrides: [],
            requires: [],
            weak: false,
            always: false,
            code: code
        };

        this.expressions.push(exp);

        return new ExpressionHelper(exp);
    }

    explodeNames(entry, namesStr)
    {
        let list = namesStr.split(/\s*,\s*/);
        for (let n of list)
            if (!n.match(/^@[A-Za-z0-9_]+[#`]?$/))
                throw new MmdlError(entry, 'Invalid name');
        return list;
    };

};


class ExpressionHelper
{
    constructor(exp)
    {
        this.exp = exp;
    }

    provides(names)
    {
        if (typeof(names) == 'string') names = [ names ];
        this.exp.provides = this.exp.provides.concat(names);
        return this;
    }

    overrides(names)
    {
        if (typeof(names) == 'string') names = [ names ];
        this.exp.overrides = this.exp.overrides.concat(names);
        return this;
    }

    requiresFromCode()
    {
        let requires = {};
        this.exp.code.replace(/@[A-Za-z0-9_]+(\`#)?/g, m => requires[m] = true);
        this.exp.requires = this.exp.requires.concat(Object.keys(requires));
        return this;
    }

    requires(names)
    {
        if (typeof(names) == 'string') names = [ names ];
        this.exp.requires = this.exp.requires.concat(names);
        return this;
    }

    always(l) { this.exp.always = l; return this; }
    location(l) { this.exp.location = l; return this; }
    struct() { this.exp.location = LocationType.Struct; return this; }
    local() { this.exp.location = LocationType.Local; return this; }
    init() { this.exp.location = LocationType.Init; return this; }
    finalize() { this.exp.location = LocationType.Finalize; return this; }
    step() { this.exp.location = LocationType.Step; return this; }

    weak() { this.exp.weak = true; return this; }
};


exports.Class = Class;
