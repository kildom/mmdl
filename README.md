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

```
class name
    definition
```

Creates new class inside this model. See **Class syntax**.

Example:
```
class Pow2
    input @X
    output @Y = @X * @X
```

### model

```
model name
    definition
```

Creates new model inside this model (sub-model). See **Model syntax**.

Example:
```
model Pow6
    input X
    output Y
    first : Pow2
        X <- X
    second : Pow2
        X = @a.Y * @X
        Y -> Y
```

### signal

```
signal name
```
```
signal name connection
```

Create a new signal. It allows adding named connection between objects. See object connection for more details about connections.

Example:
```
signal temperature <- Heating.Y
signal power
Heating
    X <- power
```

### Object creation

```
Class_or_model_name
    connections
```
```
name : Class_or_model_name
    connections
```

Create a new object - instance of a class or a model.
Form without a name will produce object with a name the same as a class or a model.

Example:
```
heater : HeatingObject
    X <- power
    Y -> scope.X1
```

#### Object connections

Object's inputs/outputs can be connected.
On the left side is always a name of input/output of current object.
Next is an arrow `<-` for inputs or `->` for outputs.
On the right side is an other end of the connection which can be:

* a signal, e.g.:
   ```
   X <- temperature
   ```
* an other object's input/output, e.g.:
   ```
   Y -> scope.X1
   ```
* if an other object have just one input or output then its name can be skipped, e.g.:
   ```
   inv1 : Inverter
   heater : HeatingObject
       X <- inv1
   ```
* inline object creation, e.g.
  ```
  heater : HeatingObject
      X <- : Inverter
          X <- obj.Y
  ```

Object's inputs can be connected to an expression using the `=` character instead of arrow.
Expression on the right side can access signals and other object's outputs by prefixing it with the `@` character.

Example:
```
Delay
    T = 12
    X = 2 * @obj1.Y + @obj2.Y
```

Type of the expression is deduced from a type of input's default value if provided. `double` is assumed if input has no default value.

TODO: inputs default type without value

### input (only submodel)

```
input name
```
```
input name connection
```

Defines a signal that is an input of the model.

Example:
```
input X -> heater.X
```

### output (only submodel)

```
output name
```
```
output name connection
```

Defines a signal that is an output of the model.

Example:
```
output temperature -> heater.Y
```

### default (only submodel)

```
default input_name = expression
```
```
default type input_name = expression
```

Assigns a default value to an input.

Example:
```
default K = 12
```

## Class syntax

All symbols defined by the class must be prefixed with `@` character.
During generation of C file this character will be replaced by some prefix to avoid collisions with other objects.
`@` character is also used to find out what symbols specific code is using.
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
default type name = value
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

