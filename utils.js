
class MmdlError extends Error
{
    constructor(entry, text)
    {
        super(`${entry.loc}: ${text}`);
    }
};

function addPrefix(prefix, obj)
{
    return JSON.parse(JSON.stringify(obj).replace(/@/g, `@${prefix}`));
};

exports.MmdlError = MmdlError;
exports.addPrefix = addPrefix;
