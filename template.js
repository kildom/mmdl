
const { MmdlError } = require('./utils.js');


const LocationType = {
    Struct: 'struct',
    Local: 'local',
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
        this.inputs = {};
        this.outputs = {};
        this.signals = {};
    }

};

exports.Template = Template;
exports.LocationType = LocationType;
