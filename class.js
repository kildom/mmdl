
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
                (e) => this.addVariable(e, e.constructCode(), LocationType.Struct) ],
            [ /^struct\s+(.+)$/,
                (e) => this.addVariable(e, e.constructCode(e[1]), LocationType.Struct) ],
            [ /^local$/,
                (e) => this.addVariable(e, e.constructCode(), LocationType.Local) ],
            [ /^local\s+(.+)$/,
                (e) => this.addVariable(e, e.constructCode(e[1]), LocationType.Local) ],
            [ /^output\s+([a-zA-Z0-9_,\s@]+)$/,
                (e) => this.addOutput(e, this.explodeNames(e, e[1]), e.constructCode(), true) ],
            [ /^output\s+(@[a-zA-Z0-9_]+)\s*=\s*(.+)$/,
                (e) => this.addOutput(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`), true) ],
            [ /^provide\s+([a-zA-Z0-9_,\s@#`]+)$/,
                (e) => this.addOutput(e, this.explodeNames(e, e[1]), e.constructCode(), false) ],
            [ /^provide\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                (e) => this.addOutput(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`), false) ],
            [ /^override\s+([a-zA-Z0-9_,\s@#`]+)$/,
                (e) => this.addOverride(e, this.explodeNames(e, e[1]), e.constructCode()) ],
            [ /^override\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                (e) => this.addOverride(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`)) ],
            [ /^default\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                (e) => this.addOutput(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`), true, -1) ],
            [ /^init\s+([a-zA-Z0-9_,\s@#`]+)$/,
                (e) => this.addInit(e, this.explodeNames(e, e[1]), e.constructCode()) ],
            [ /^init\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                (e) => this.addInit(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`)) ],
            [ /^finalize\s+([a-zA-Z0-9_,\s@#`]+)$/,
                (e) => this.addFinalize(e, this.explodeNames(e, e[1]), e.constructCode()) ],
            [ /^finalize\s+(@[a-zA-Z0-9_]+[#`]?)\s*=\s*(.+)$/,
                (e) => this.addFinalize(e, this.explodeNames(e, e[1]), e.constructCode(`${e[1]} = ${e[2]}`)) ],
            [ /^state\s+(@[a-zA-Z0-9_]+)(#|`)\s*=\s*(.+)$/,
                (e) => this.addState(e, this.explodeNames(e, e[1]), e[2], e.constructCode(`${e[1]}${e[2]} = ${m[3]}`)) ],
            [ /^state\s+(@[a-zA-Z0-9_]+)(#|`)$/,
                (e) => this.addState(e, this.explodeNames(e, e[1]), e[2], e.constructCode()) ],
            [ /.*/,
                (e) => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let entry of sub)
            entry.multiMatch(patterns);
    }

    addState(entry, names, type, code)
    {
        let name = names[0];
        if (type == '`')
        {
            this.addExpression(entry, `   double ${name}\`;\r\n`)
                .local()
                .provides(`${name}\``)
                .priority(-1)
                .unique();
            this.addExpression(entry, code)
                .provides(`${name}\``);
            this.addExpression(entry, `    ${name}# = ${name}\` * dt;\r\n`)
                .provides(`${name}#`);
        }
        else
        {
            this.addExpression(entry, code)
                .provides(`${name}#`);
        }
        this.addExpression(entry, `    ${name} = ${name}#;\r\n`)
            .overrides(name);
        this.addExpression(entry, `   double ${name}#;\r\n`)
            .local()
            .provides(`${name}#`)
            .priority(-1)
            .unique();
        this.addExpression(entry, `   double ${name};\r\n`)
            .struct()
            .provides(`${name}`)
            .priority(-1)
            .unique();
    }

    addVariable(entry, code, location)
    {
        let provides = {};
        code.replace(/@[A-Za-z0-9_](\`#)?+/g, m => provides[m] = true);
        this.addExpression(entry, code)
            .location(location)
            .provides(Object.keys(provides));
    }

    addOutput(entry, names, code, addLocal, priority)
    {
        priority = priority || 0;
        this.addExpression(entry, code)
            .provides(names)
            .priority(priority);
        if (addLocal)
        {
            for (let n of names)
            {
                this.addExpression(entry, `    double ${n};\r\n`)
                    .local()
                    .provides(n)
                    .priority(-1)
                    .unique();
            }
        }
    }

    addOverride(entry, names, code)
    {
        this.addExpression(entry, code)
            .overrides(names);
    }

    addInit(entry, names, code)
    {
        this.addExpression(entry, code)
            .init()
            .provides(names);
    }

    addFinalize(entry, names, code)
    {
        this.addExpression(entry, code)
            .finalize()
            .provides(names);
    }

    addExpression(entry, code)
    {

        let exp = {
            loc: entry.loc,
            location: LocationType.Step,
            provides: [],
            overrides: [],
            requires: [],
            priority: 0,
            unique: false,
            valid: true,
            code: code
        };

        this.expressions.push(exp);

        return new ExpressionHelper(exp);
    }

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

    struct() { this.exp.location = LocationType.Struct; return this; }
    local() { this.exp.location = LocationType.Local; return this; }
    init() { this.exp.location = LocationType.Init; return this; }
    finalize() { this.exp.location = LocationType.Finalize; return this; }
    step() { this.exp.location = LocationType.Step; return this; }

    priority(level) { this.exp.priority = level; return this; }
    
    unique() { this.exp.unique = true; return this; }
};


exports.Class = Class;
