import rotaryio
import board
import time
import json
from digitalio import DigitalInOut, Direction, Pull

# setup the hardware
# little hack: By supporting the switch with 3.3V via the output pin GP10,
# we can solder the rotary encoder straight to the continius pins from GND to GP13
# which makes the assembly easier

'''
another hack: when using SIX pins on the pico (GND, GP10, GP11, GP12, GP13, GND),
the rotary encoder can be plugged in either showing upwards or downwards depenting on the
final mounting to define in which direction the onboard LED should shine to.

If the rotary encoder axle shows in the same direction as the LED, the flag 

LED_AND_AXLE_SAME_DIRECTION is set to TRUE, the switch is connected from GP10 to GND

If the rotary encoder axle shows in opposite direction as the LED, the flag 

LED_AND_AXLE_SAME_DIRECTION is set to FALSE, the switch is connected from GND to GP13



'''
LED_AND_AXLE_SAME_DIRECTION= True

if LED_AND_AXLE_SAME_DIRECTION:
    power_pin_gpio=board.GP13
    button_pin_gpio=board.GP12
    button_rot_A_gpio=board.GP11
    button_rot_B_gpio=board.GP10
else:
    power_pin_gpio=board.GP10
    button_pin_gpio=board.GP11
    button_rot_A_gpio=board.GP12
    button_rot_B_gpio=board.GP13

rotary_encoder_power = DigitalInOut(power_pin_gpio)
rotary_encoder_power.direction = Direction.OUTPUT
rotary_encoder_power.value = True
rotary_encoder_button = DigitalInOut(button_pin_gpio)
rotary_encoder_button.direction = Direction.INPUT
rotary_encoder_button.pull = Pull.DOWN
enc = rotaryio.IncrementalEncoder(button_rot_A_gpio, button_rot_B_gpio)
led = DigitalInOut(board.LED)
led.direction = Direction.OUTPUT


# init some variables and constants
calibrated = 1  # is the wheel already calibrated? 0 if not, otherways it contains the number of ticks for one complete turn
calibrated_zero_pos = 0  # absolute position at end of calibration
calibration_start_pos = 0  # stores the position at calibration start
start_calibration_mode = False  # is set to true if calibration starts by pressing the button, but button is still pressed
in_calibration_mode = False  # is set to true if device is in calibration mode
button_state = False  # the actual button state
last_button_state = False  # last button state to detect state change
led_dark_time = 0  # used to blink the led during calibration. 0 if LED is on, otherways its counted down with each tick
LED_NOT_CALIBRATED = 2  # defines the led flash rate when not calibrated
LED_IN_CALIBRATION = 5  # defines the led flash during calibration
REPORT_TICKS = 50  # sends a report all 5 secs
report_tick_counter = 0  # counts down until the next report
position = None
calibrated_position = 0
last_position = None
button_press_ticks = 0  # counts the ticks how long the button is pressed. Max value is limited by BUTTON_LONG_PRESS_TICKS
BUTTON_LONG_PRESS_TICKS = (
    20  # number of ticks the button need to be pressed to be a long press
)


def report_state(turning):
    global calibrated, in_calibration_mode, start_calibration_mode, button_state, calibrated_position
    print(
        json.dumps(
            {
                "calibrated": abs(calibrated) > 1
                and not in_calibration_mode
                and not start_calibration_mode,
                "button": button_state,
                "position": abs(calibrated_position),
                "positions": abs(calibrated),
                "turning": turning,
            }
        )
    )


while True:
    # check the button state for long press
    button_state = not rotary_encoder_button.value
    if button_state:
        # print("DOWN")
        if button_press_ticks < BUTTON_LONG_PRESS_TICKS:
            button_press_ticks += 1
        if button_press_ticks == BUTTON_LONG_PRESS_TICKS:  # calibration request
            calibrated = 1
            start_calibration_mode = True
            # print("init calibration")
            calibration_start_pos = position
        # do we just finish a calibration mode?
        if in_calibration_mode:
            in_calibration_mode = False
            calibrated = (
                calibration_start_pos - position
            )  # number of steps for one complete turn
            calibrated_zero_pos = position
            # print("end calibration", calibrated)
    else:
        # are we just had a calibration request with a pressed button?
        if start_calibration_mode:
            # print("begin calibration")
            start_calibration_mode = False  # button is released
            in_calibration_mode = True
            calibration_start_pos = position
        button_press_ticks = 0
    position = enc.position
    if position != last_position or last_button_state != button_state:
        calibrated_position = (position - calibrated_zero_pos) % calibrated
        report_state(position != last_position)
        report_tick_counter = REPORT_TICKS
    report_tick_counter -= 1
    if report_tick_counter < 1:  # it's time for a report
        report_state(False)
        report_tick_counter = REPORT_TICKS
    last_position = position
    last_button_state = button_state
    # and finally we control the led
    if abs(calibrated) > 1 and not in_calibration_mode and not start_calibration_mode:
        led.value = True
    else:
        led_dark_time -= 1
        if led_dark_time < 1:
            led.value = not led.value
            if in_calibration_mode or start_calibration_mode:
                led_dark_time = LED_IN_CALIBRATION
            else:
                led_dark_time = LED_NOT_CALIBRATED
    time.sleep(0.1)  # timebase - one delay is one tick
