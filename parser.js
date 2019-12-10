const fs = require('fs');
const { MmdlError } = require('./utils.js');


class Entry
{
    constructor(text, loc)
    {
        this.text = text;
        this.loc = loc;
        this.sub = [];
        this.m = [];
    }

    getInnerCode(ind)
    {
        let code = '';
        ind = ind || '';
        for (let entry of this.sub)
        {
            code += `${ind}${entry.text}\r\n`;
            code += entry.getInnerCode(`${ind}    `);
        }
        return code;
    }
    
    constructCode(inlineCode)
    {
        if (inlineCode)
        {
            if (this.sub.length)
                throw new MmdlError(this.sub[0], 'Code already provided.');
            return `${inlineCode};\r\n`;
        }
        else
        {
            if (this.sub.length == 0)
                throw new MmdlError(this, 'No code provided.');
            return this.getInnerCode();
        }
    }

    match(pattern)
    {
        let m = this.text.match(pattern);
        if (!m) return false;
        for (let i = 0; i < m.length; i++)
            this[i] = m[i];
        for (let i = m.length; i < this.m.length; i++)
            delete this[i];
        this.m = m;
        return true;
    }

    multiMatch(patterns)
    {
        for (let i = 0; i < patterns.length; i++)
        {
            let m = this.match(patterns[i][0]);
            if (m)
            {
                patterns[i][1](this);
                break;
            }
        }
    }
};

class Parser
{
    constructor()
    {
        this.root = new Entry('', '');
    }
    
    parse(file)
    {
        let lines = fs.readFileSync(file, 'UTF-8');
        lines = lines.split(/\r?\n/);
        let cur = this.root;
        let ind = '';
        let last = null;
        let indStack = [];
        let objStack = [];
        for (let i = 0; i < lines.length; i++)
        {
            let line = lines[i].trimRight();
            if (line.trim().startsWith('\'') || line.trim() == '') continue;
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
                last = new Entry(line.trim(), `${file}:${i + 1}`);
                cur.sub.push(last);
            }
        }
    }

    getRoot()
    {
        return this.root;
    }
};

exports.Parser = Parser;
