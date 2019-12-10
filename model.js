
const { Template } = require('./template.js');
const { Class } = require('./class.js');


class Model extends Template
{
    constructor(entry, name)
    {
        super(entry, name);
        this.classes = {};
        this.parseSub(entry.sub);
    }

    parseSub(sub)
    {
        let patterns = [
            [ /^class\s+([a-zA-Z0-9_]+)$/,
                (e) => this.addClass(e, e[1]) ],
            [ /.*/,
                (e) => { throw new MmdlError(e, "Syntax error."); } ]
        ];
        for (let entry of sub)
            entry.multiMatch(patterns);
    }

    addClass(entry, name)
    {
        let cls = new Class(entry, name);
        this.classes[name] = cls;
    }

};


exports.Model = Model;
