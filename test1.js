
function replacePostfix(text)
{
    return text.replace(/([a-zA-Z0-9_]+)#/g, '$1__next__').replace(/([a-zA-Z0-9_]+)`/g, '$1__det__');
}

class Class
{
    constructor()
    {
        this.expressions = [];
        this.prefix = 'test1__';
    }

    addExpression(provides, overrides, code)
    {
        provides = provides.map(n => '@' + replacePostfix(n));
        overrides = overrides.map(n => '@' + replacePostfix(n));
        code = replacePostfix(code);
        let depends = {};
        code.replace(/(@[a-zA-Z0-9_]+)/g, (_, m) => { depends[m] = true; });
        for (let n of provides) delete depends[n];
        for (let n of overrides) delete depends[n];
        let exp = {
            provides: provides,
            overrides: overrides,
            depends: Object.keys(depends),
            code: code
        }
        this.expressions.push(exp);
    }

    replace(text)
    {
        return text.replace(/@/g, '@' + this.prefix);
    }

    provideExpressions(model)
    {
        JSON.parse(this.replace(JSON.stringify(this.expressions))).map(x => model.addExpression(x));
    }
};

class Model
{
    constructor()
    {
        this.expressions = [];
    }
    addExpression(exp)
    {
        this.expressions.push(exp);
    }
    mergeExpressions()
    {
        let map = {};
        for (let exp of this.expressions)
        {
            let key = JSON.stringify([exp.provides, exp.overrides]);
            if (key in map)
            {
                let exp2 = map[key];
                exp2.code += exp.code;
                exp2.depends = exp2.depends.concat(exp.depends).filter((v,i,a) => a.indexOf(v) === i);
            }
            else
            {
                map[key] = exp;
            }
        }
        this.expressions = Object.keys(map).map(k => map[k]);
    }
    addConnection(input, output)
    {
        let re = new RegExp(`${input}([^a-zA-Z0-9_])`, 'g');
        this.expressions = JSON.parse(JSON.stringify(this.expressions).replace(re, `${output}$1`));
    }
    reorder()
    {
        let counter = 0;
        let stack = [... this.expressions];
        let provided = {};
        let mapProvides = {};
        let mapOverrides = {};
        this.expressions.map(exp => {
            exp.provides.map(s => {
                if (!s.startsWith('@')) return;
                if (!(s in mapProvides)) mapProvides[s] = [];
                mapProvides[s].push(exp);
            });
            exp.overrides.map(s => {
                if (!s.startsWith('@')) return;
                if (!(s in mapOverrides)) mapOverrides[s] = [];
                mapOverrides[s].push(exp);
            });
        });
        while (stack.length > 0)
        {
            let exp = stack.pop();
            if ('index' in exp) continue;
            let done = true;
            exp.depends.map(n => { if (!n.startsWith('@')) return; if (!(n in provided)) done = false; });
            if (!done)
            {

            }
        }
    }
}

c = new Class();
c.addExpression(['K'], [], '@K = 1.0;\r\n');
c.addExpression(['x`'], [], '@x` = @K * (@U - @x);\r\n');
c.addExpression(['x#'], [], '@x# = @x` * dt;\r\n');
c.addExpression(['x#'], [], '@x# = range(@x#);\r\n');
c.addExpression([], ['x'], '@x = @x#;\r\n');
c.addExpression(['y'], [], '@y = @U - @x;\r\n');

let obj1 = Object.create(c);
obj1.prefix = 'obj1__';
let obj2 = Object.create(c);
obj2.prefix = 'obj2__';

m = new Model();
obj1.provideExpressions(m);
obj2.provideExpressions(m);
m.mergeExpressions();
m.addConnection('@obj1__U', '@obj2__y');
m.addConnection('@obj2__K', '(3.03)');
m.reorder();


console.log(JSON.stringify(m, null, 4));
