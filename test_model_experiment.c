

#define dt 0.001

typedef struct SimuState_s
{
    uint64_t step;
    double time;
    double mainU;
    double mainY;
    double TESTOBJ__x;
} SimuState_t;

void simuInit(SimuState_t* state)
{
    // Init code
    state->step = 0;
    state->time = 0.0;
    state->TESTOBJ__x = 10.0;
}

void simu(uint64_t steps, SimuState_t* state, SimuCallback callback)
{
    // Locals code
    uint64_t step;
    double time;
    double TESTOBJ__x;
    double TESTOBJ__x__next;
    double TESTOBJ__x__det;
    double TESTOBJ__U;
    double TESTOBJ__y;

    // Restore code
    step = state->step;
    _stepEnd = step + steps;
    time = state->time;
    TESTOBJ__x = state->TESTOBJ__x;

    for (step = step; step < _stepEnd; step++)
    {
        // Input/output code
        TESTOBJ__U = state->mainU;
        TESTOBJ__y = TESTOBJ__x + TESTOBJ__U;
        // If dierect interface
        //if (callback) callback(state); - somewhere in Input/output code
        state->mainY = TESTOBJ__y;
        TESTOBJ__K = 1.0;
        TESTOBJ__MIN = 0.0;
        TESTOBJ__MAX = 1.0;
        // Next state code
        TESTOBJ__x__det = TESTOBJ__K * (TESTOBJ__U - TESTOBJ__x);
        TESTOBJ__x__next = TESTOBJ__x__det * dt;
        TESTOBJ__x__next = Range(TESTOBJ__x__next, TESTOBJ__MIN, TESTOBJ__MAX);
        // If indierect interface
        if (callback) callback(state);
        // Apply code
        TESTOBJ__x = TESTOBJ__x__next;
        time += dt;
        state->time = time;
    }
    state->TESTOBJ__x = TESTOBJ__x;
}

/*


class TEST
    state x` = @U - @x
    output y = @U - @x

class INTERFACE
    struct
        SimuCallback callback;
    locals
        SimuCallback callback;
    restore
        callback = state->callback;
    output mainY
        @mainY = callback(step, time, @mainU);

TEST
    U = interface.mainU


class items:
    - struct - code to place in state structure
    - init - code to place in state initialization function
    - locals - code to place in simulation function local valiables
    - restore - code to restore locals from state structure
    - store - code to store locals in the state structure
    - output [name[,name[,...]]] - code to calculate output data (multiple outputs should be grouped only if needed)
            names starting with _ are private
    - output name = code; - short notation of above
    - provide [name[,name[,...]]] - like output, but does not allocate local variables automatically
    - override [name[,name[,...]]] - code that overrides symbols with value for the next step
    - state x - code to calculate next value of the state (using differential or directly)
    - state x` = code; - short notation of differential
    - state x# = code; - short notation of direct calculation of next state value
    - default name - code to calculate input value if it is not connected
    - init x = code; - short notation of state initialization
    
class OBJ1RZ
    default init = 0.0;
    init x = @init;
    state x` = @K * (@U - @x);
    output y = x

class OBJ1RZ_RAW
    default init = 0.0;
    struct
        double @x;
    init x = @init;
    local
        double @x;
        double @y;
        double @_x__det;
        double @_x__next;
    restore
        @x = state.@x;
    provide _x__det = @K * (@U - @x);
    provide _x__next = @_x__det * dt;
    provide y = @x;
    override x = @_x__next;
    store
        state.@x = @x;
   

*/
