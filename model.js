
const { Template } = require('./template.js');
const { Class } = require('./class.js');
const { MmdlError } = require('./utils.js');


class Model extends Template
{
    constructor(entry, name)
    {
        super(entry, name);
        this.classes = {};
        this.objects = {};
        this.nextSignalId = 1;
        this.parseSub(entry.sub);
        this.connectAll();
    }

    parseSub(sub)
    {
        let patterns = [
            [ /^class\s+([a-zA-Z0-9_]+)$/,
                e => this.addClass(e, e[1]) ],
            [ /^signal\s+([a-zA-Z0-9_]+)$/,
                e => this.addSignal(e, e[1]) ],
            [ /^([a-zA-Z0-9_]+)$/,
                e => this.addObject(e, e[1], e[1]) ],
            [ /^([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_]+)$/,
                e => this.addObject(e, e[1], e[2]) ],
            [ /.*/,
                e => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let entry of sub)
            entry.multiMatch(patterns);
    }

    addClass(entry, name)
    {
        let cls = new Class(entry, name);
        this.classes[name] = cls;
    }

    addSignal(entry, name)
    {
        if (name in this.signals)
            throw new MmdlError(entry, "Signal already defined");
        if (entry.sub.length > 0)
            throw new MmdlError(entry, "Syntax error");
        this.signals[name] = {
            loc: entry.loc,
            name: name,
            from: null,
            to: []
        }
    }

    addObject(entry, name, className)
    {
        if (!(className in this.classes))
            throw new MmdlError(entry, "Class not found");
        if (name in this.objects)
            throw new MmdlError(entry, "Object already defined");
        let cls = this.classes[className];
        this.fetchExpressions(cls, name);
        this.objects[name] = {
            loc: entry.loc,
            entry: entry,
            name: name,
            cls: cls,
            inputs: {}
        };
    }
    
    fetchExpressions(src, prefix)
    {
        let str = JSON.stringify(src.expressions);
        str = str.replace(/@([a-zA-Z0-9_])/g, `@${prefix}__$1`);
        let exp = JSON.parse(str);
        this.expressions = this.expressions.concat(exp);
    }

    connectAll()
    {
        let obj;
        let patterns = [
            [ /^([a-zA-Z0-9_]+)\s*->\s*([a-zA-Z0-9_]+)$/,
                e => this.connectOutput(obj, e, e[1], e[2]) ],
            [ /^([a-zA-Z0-9_]+)\s*->\s*([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)$/,
                e => this.connectOutput(obj, e, e[1], e[2], e[3]) ],
            [ /^([a-zA-Z0-9_]+)\s*<-\s*([a-zA-Z0-9_]+)$/,
                e => this.connectInput(obj, e, e[1], e[2]) ],
            [ /^([a-zA-Z0-9_]+)\s*<-\s*([a-zA-Z0-9_]+)\s*\.\s*([a-zA-Z0-9_]+)$/,
                e => this.connectInput(obj, e, e[1], e[2], e[3]) ],
            [ /^([a-zA-Z0-9_]+)\s*=\s*(.+)$/,
                e => this.connectCode(obj, e, e[1], e[2]) ],
            // TODO: Input and output
            [ /.*/,
                e => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let objName in this.objects)
        {
            obj = this.objects[objName];
            for (let entry of obj.entry.sub)
                entry.multiMatch(patterns);
        }
    }

    connectOutput(obj, entry, from, to, toField)
    {
        let toObj;
        // TODO: From or toField may be an alias in class (input/output in submodel), so alias resolving have to be implemented
        // This may be done by internal signals in submodel (not at this level), but correct order of replacing must be kept later.
        if (!(`@${from}` in obj.cls.outputs))
            throw new MmdlError(entry, `Output not defined in class`);
        if (toField)
        {
            if (!(to in this.objects))
                throw new MmdlError(entry, `Object '${to}' does not exists`);
            toObj = this.objects[to];
        }
        else
        {
            if (to in this.signals)
            {
                if (this.signals[to].from !== null)
                    throw new MmdlError(entry, `Signal source already connected to '${this.signals[to].from}'`);
                this.signals[to].from = `@${obj.name}__${from}`;
                return;
            }
            else if (to in this.objects)
            {
                toObj = this.objects[to];
                if (Object.keys(toObj.cls.inputs).length != 1)
                    throw new MmdlError(entry, `Exactly one input allowed in '${to}'`);
                for (toField in toObj.cls.inputs);
                toField = toField.substr(1);
            }
            else
            {
                throw new MmdlError(entry, `Signal or object '${to}' does not exists`);
            }
        }
        if (!(`@${toField}` in toObj.cls.inputs))
            throw new MmdlError(entry, `Input not defined in class`);
        let signalName = 'auto$' + (this.nextSignalId++);
        this.signals[signalName] = {
            loc: entry.loc,
            name: signalName,
            from: `@${obj.name}__${from}`,
            to: [ `@${toObj.name}__${toField}` ]
        };
        toObj.inputs[toField] = true;
    }

    connectInput(obj, entry, to, from, fromField)
    {
        let fromObj;
        if (!(`@${to}` in obj.cls.inputs))
            throw new MmdlError(entry, `Input not defined in class`);
        if (fromField)
        {
            if (!(from in this.objects))
                throw new MmdlError(entry, `Object '${from}' does not exists`);
            fromObj = this.objects[from];
        }
        else
        {
            if (from in this.signals)
            {
                this.signals[from].to.push(`@${obj.name}__${to}`);
                return;
            }
            else if (from in this.objects)
            {
                fromObj = this.objects[from];
                if (Object.keys(fromObj.cls.outputs).length != 1)
                    throw new MmdlError(entry, `Exactly one output allowed in '${from}'`);
                for (fromField in fromObj.cls.outputs);
                fromField = fromField.substr(1);
            }
            else
            {
                throw new MmdlError(entry, `Signal or object '${from}' does not exists`);
            }
        }
        if (!(`@${fromField}` in fromObj.cls.outputs))
            throw new MmdlError(entry, `Output not defined in class`);
        let signalName = 'auto$' + (this.nextSignalId++);
        this.signals[signalName] = {
            loc: entry.loc,
            name: signalName,
            from: `@${fromObj.name}__${fromField}`,
            to: [ `@${obj.name}__${to}` ]
        };
        obj.inputs[to] = true;
    }

    connectCode(obj, entry, to, code)
    {
        if (!(`@${to}` in obj.cls.inputs))
            throw new MmdlError(entry, `Input not defined in class`);
        let signalName = 'code$' + (this.nextSignalId++);
        this.signals[signalName] = {
            loc: entry.loc,
            name: signalName,
            from: `(${code})`,
            to: [ `@${obj.name}__${to}` ]
        };
        obj.inputs[to] = true;
    }

};


exports.Model = Model;
