# mmdl
Tool for embedding simulation of mathematical model into C test programs

# Generated simulation overview

TODO

# Model file syntax

Model file contains objects, classes and submodels.

Object is an instance of specific class.
Object contains inputs and outputs which can be interconnected.
Connection optionally can be named.
Named connection is called signal.

Class describes behavior of the object.
It contains C code and expressions that will be placed inside generated output C file.

Submodel describes behavior of the object, not using C, but using objects contained in it.
Defined submodel can be later used exactly the same as class.

## Model syntax

### class
### model
### signal
### Object creation
### input (only submodel)
### output (only submodel)
### default (only submodel)

## Class syntax

All symbols defined by the class must be prefixed with `@` character.
During generation of C file this character will be replaced by some prefix to avoid collisions with other objects.
`@` character is also used to findout what symbols specific code is using.
Postfix `` ` `` or `#` can be used to indicate that this symbol contains differetial or a value for the next simulation step.

### struct

```
struct
    fields
```

```
struct field
```

Add a new field into state structure.

Example:
```
struct double @x
struct
    uint8_t* @buffer;
    int @index;
```


### local

```
local
    variables
```

```
local variable
```

Add a new local variable for simulation function.

Example:
```
local double @x
local
    uint8_t* @buffer = NULL;
    int @index = 0;
```

### input

```
input name
```

Add symbol to list of class inputs.

Example:
```
input @U
```

### output

```
output name = value
```

```
output names
    code
```

Creates a new output. It creates a new local variable of type `double`, but it can be overriten by explicit local variable declaration.

Example:
```
output @Y = @x * @K
output @Z, @W
    @Z = calcZWValue(&@W);
```

### provide

```
provide name = value
```

```
provide names
    code
```

Provides code to calculate specific symbols. It does not create a new local variable.

Example:
```
local int @i
provide @i = (int)(@T + 0.5);
```

### provide always

```
provide always|init|finalize
    code
```

Provides code that will be always executed. `always` will place code in main simulation loop. `init` will place code into state initialization function. `finalize` will place code into state destruction function.

Example:
```
provide init
    debug_print("initialization...");
provide finalize
    debug_print("simulation done");
provide always
    debug_print("signal value at %f equals %f", state->time, @y);
```

### default

```
default name = value
```

```
default names
    code
```

Provides default code for inputs. If input is not connected then this code will be used to calculate value of the input.

Example:
```
input @K
default @K = 1.0;
```

### override

```
override name = value
```

```
override names
    code
```

Provides code that overrides symbol with a new value (for the next step). Code will be executed after all expressions that depends on it are executed.

Example:
```
struct int @counter;
override @counter = @counter + 1;

```

### init

```
init name = value
```

```
init names
    code
```

Provides code that will be placed into simulation initialization function to initialize state structure.

Example:
```
init @x = @x0
init @buffer, @len
    @len = 1024;
    @buffer = malloc(@len);

```

### finalize

```
finalize names
    code
```

Provides code that will be placed into simulation finalization function to free resources from state structure.

Example:
```
finalize @buffer
    free(@buffer);

```

### state

```
state name` = value
state name# = value
```

```
state name`
    code
state name#
    code
```

Simplyfied method of providing state of the object. It will automatically create field in state structure and place code to update with new value.

Version with `` ` `` defines differential of this state variable. Code to calculate next value will be automatically placed after it (using Euler method). And the result placed into variabled ended with `#`.

Version with `#` defines next value of this state variable.

Example:
```
state @x` = @U - @x;
```

