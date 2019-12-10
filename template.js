
const { MmdlError } = require('./utils.js');


const LocationType = {
    Struct: 'struct',
    Local: 'lcoal',
    Init: 'init',
    Finalize: 'finalize',
    Step: 'step'
};

class Template
{
    constructor(entry, name)
    {
        this.templateName = name;
        this.loc = entry.loc;
        this.expressions = [];
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

exports.Template = Template;
exports.LocationType = LocationType;
